import html
import os
import re
from datetime import datetime, timedelta

from azure.storage.blob import BlobServiceClient, BlobSasPermissions, generate_blob_sas


def get_blob_service_client():
    conn_str = os.environ["BLOB_CONNECTION_STRING"]
    return BlobServiceClient.from_connection_string(conn_str)


def download_blob_text(blob_path, container_name=None, encoding="utf-8-sig"):
    container = container_name or os.environ["BLOB_CONTAINER_NAME"]
    blob_client = get_blob_service_client().get_blob_client(container=container, blob=blob_path)
    return blob_client.download_blob().readall().decode(encoding)


_TITLE_RE = re.compile(rb"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
_META_RE = re.compile(rb"<meta\s+([^>]*)>", re.IGNORECASE)
_ATTR_RE = re.compile(rb'(\w+)\s*=\s*["\']([^"\']*)["\']')


def _clean_text(raw_bytes):
    text = html.unescape(raw_bytes.decode("utf-8", errors="ignore"))
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def get_html_metadata(blob_path, container_name=None, peek_bytes=8192):
    """Read the first `peek_bytes` of an HTML blob and pull out <title> and
    <meta name="description">, if present. Used to label report cards without
    needing separate per-grant metadata — the title/description live with the
    report content itself. Returns {"title": str|None, "description": str|None},
    both None if the blob can't be read or the tags aren't found."""
    container = container_name or os.environ["BLOB_CONTAINER_NAME"]
    blob_client = get_blob_service_client().get_blob_client(container=container, blob=blob_path)

    try:
        data = blob_client.download_blob(offset=0, length=peek_bytes).readall()
    except Exception:
        return {"title": None, "description": None}

    title_match = _TITLE_RE.search(data)
    title = _clean_text(title_match.group(1)) if title_match else None

    description = None
    for meta_match in _META_RE.finditer(data):
        attrs = dict(_ATTR_RE.findall(meta_match.group(1)))
        if attrs.get(b"name", b"").lower() == b"description":
            description = _clean_text(attrs.get(b"content", b""))
            break

    return {"title": title, "description": description}


def generate_read_sas_url(blob_path, container_name=None, expiry_minutes=15, content_disposition=None):
    container = container_name or os.environ["BLOB_CONTAINER_NAME"]
    service_client = get_blob_service_client()
    blob_client = service_client.get_blob_client(container=container, blob=blob_path)

    sas_token = generate_blob_sas(
        account_name=service_client.account_name,
        container_name=container,
        blob_name=blob_path,
        account_key=service_client.credential.account_key,
        permission=BlobSasPermissions(read=True),
        expiry=datetime.utcnow() + timedelta(minutes=expiry_minutes),
        content_disposition=content_disposition
    )

    return f"{blob_client.url}?{sas_token}"
