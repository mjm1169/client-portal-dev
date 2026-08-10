import json
import logging
import re

import azure.functions as func

from shared.auth import get_user_email
from shared.blob import generate_read_sas_url, get_html_metadata
from shared.db import log_access
from shared.product_access import get_product_access

# Each product lives in its own blob container, so keep "product" to a safe, known set.
KNOWN_PRODUCTS = {"scrollytelling", "industry-analytics"}

_PRODUCT_RE = re.compile(r"^[a-z0-9_-]+$")


def _container_for_product(product):
    # Azure Blob container names allow lowercase letters, digits, and hyphens
    # only (no underscores), so "industry_analytics" -> "industry-analytics".
    return product.replace("_", "-")


def main(req: func.HttpRequest) -> func.HttpResponse:
    product = req.route_params.get("product")

    if not product or not _PRODUCT_RE.match(product) or product not in KNOWN_PRODUCTS:
        return func.HttpResponse("Not found", status_code=404)

    email = None
    try:
        email = get_user_email(req)
        if not email:
            log_access("unknown", product, "unauthorized")
            return func.HttpResponse("Unauthorized", status_code=401)

        grants = get_product_access(email, product)
        if not grants:
            log_access(email, product, "forbidden_no_access")
            return func.HttpResponse("Forbidden", status_code=403)

        # If the user has multiple clients under this product, the frontend can
        # request a specific one via ?client=. Default to the first assigned client.
        requested_client = req.params.get("client")
        if requested_client:
            grant = next((g for g in grants if g["client"] == requested_client), None)
            if not grant:
                log_access(email, product, "forbidden_wrong_client", requested_client)
                return func.HttpResponse("Forbidden", status_code=403)
        else:
            grant = grants[0]

        container = _container_for_product(product)

        blob_path = f"{grant['client']}/{grant['blob_name']}"
        url = generate_read_sas_url(blob_path, container_name=container)

        # Every grant the user has for this product, each with its own view (inline)
        # and download (forces Save As, correct filename even cross-origin) SAS url.
        # Title/description are only worth reading (an extra blob fetch each) when
        # there's actually a picker to label — skip them on the single-file path.
        show_metadata = len(grants) > 1
        files = []
        for g in grants:
            g_blob_path = f"{g['client']}/{g['blob_name']}"
            metadata = (
                get_html_metadata(g_blob_path, container_name=container)
                if show_metadata and g["blob_name"].lower().endswith(".html")
                else {"title": None, "description": None}
            )
            files.append({
                "client": g["client"],
                "blobName": g["blob_name"],
                "title": metadata["title"],
                "description": metadata["description"],
                "viewUrl": generate_read_sas_url(g_blob_path, container_name=container),
                "downloadUrl": generate_read_sas_url(
                    g_blob_path,
                    container_name=container,
                    content_disposition=f'attachment; filename="{g["blob_name"]}"'
                )
            })

        log_access(email, product, "success", f"{container}/{blob_path}")

        return func.HttpResponse(
            json.dumps({
                "url": url,
                "clients": [g["client"] for g in grants],
                "currentClient": grant["client"],
                "files": files
            }),
            status_code=200,
            mimetype="application/json"
        )

    except Exception as exc:
        logging.exception("Unhandled exception in /api/reports")
        detail = f"{type(exc).__name__}: {exc}"
        log_access(email or "unknown", product, "error", detail)

        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )
