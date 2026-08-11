import json
import re

import azure.functions as func

from shared.auth import get_user_email
from shared.db import log_access
from shared.product_access import get_product_access

# Membership-only gate for products that don't serve a file (unlike /api/reports/{product},
# which reads ProductAccess AND hands back a blob SAS url). ProductAccess still requires a
# non-null client/blob_name per row, so these products are granted with the sentinel
# ('all', product) pair — see api/sql for the actual grants.
KNOWN_PRODUCTS = {"segmentation"}

_PRODUCT_RE = re.compile(r"^[a-z0-9_-]+$")


def main(req: func.HttpRequest) -> func.HttpResponse:
    product = req.route_params.get("product")

    if not product or not _PRODUCT_RE.match(product) or product not in KNOWN_PRODUCTS:
        return func.HttpResponse("Not found", status_code=404)

    email = get_user_email(req)
    if not email:
        log_access("unknown", product, "unauthorized")
        return func.HttpResponse("Unauthorized", status_code=401)

    grants = get_product_access(email, product)
    if not grants:
        log_access(email, product, "forbidden_no_access")
        return func.HttpResponse("Forbidden", status_code=403)

    log_access(email, product, "success")
    return func.HttpResponse(
        json.dumps({"access": True}),
        status_code=200,
        mimetype="application/json"
    )
