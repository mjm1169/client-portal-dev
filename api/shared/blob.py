import os
from datetime import datetime, timedelta

from azure.storage.blob import BlobServiceClient, BlobSasPermissions, generate_blob_sas


def get_blob_service_client():
    conn_str = os.environ["BLOB_CONNECTION_STRING"]
    return BlobServiceClient.from_connection_string(conn_str)


def download_blob_text(blob_path, container_name=None, encoding="utf-8-sig"):
    container = container_name or os.environ["BLOB_CONTAINER_NAME"]
    blob_client = get_blob_service_client().get_blob_client(container=container, blob=blob_path)
    return blob_client.download_blob().readall().decode(encoding)


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
