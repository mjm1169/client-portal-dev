import azure.functions as func
import base64
import json
import os
import logging
from azure.storage.blob import BlobServiceClient
import csv
import io

def get_user_email(req):
    import base64
    import json

    header = req.headers.get("x-ms-client-principal")

    # LOCAL DEV: no auth header
    if not header:
        return "local.user@company.com"

    # AZURE: real auth header
    decoded = base64.b64decode(header)
    principal = json.loads(decoded)

    return principal.get("userDetails")

def get_sql_connection():
    import pyodbc
    conn_str = os.environ["SQL_CONNECTION_STRING"]
    return pyodbc.connect(conn_str)

def get_dataset_for_user(email):

    # Local dev mode
    if os.environ.get("WEBSITE_SITE_NAME") is None:
        # Running locally
        return "data1.csv"

    # Production mode → use SQL
    conn = get_sql_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT datasetFile FROM UserDatasetAccess WHERE email = ?",
        email
    )

    row = cursor.fetchone()

    return row[0] if row else None

""" def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        email = get_user_email(req)

        if not email:
            return func.HttpResponse("Unauthorized", status_code=401)

        dataset_file = get_dataset_for_user(email)

        if not dataset_file:
            return func.HttpResponse("Forbidden", status_code=403)

        data = get_dataset_from_blob(dataset_file)

        return func.HttpResponse(
            json.dumps(data),
            status_code=200,
            mimetype="application/json"
        )

    except Exception as e:
        logging.exception("Unhandled exception in /api/me")

    return func.HttpResponse(
        json.dumps({"error": "Internal server error"}),
        status_code=500,
        mimetype="application/json"
    ) """
def main(req: func.HttpRequest) -> func.HttpResponse:
    email = get_user_email(req)
    print("DEBUG EMAIL:", email)

    if not email:
        return func.HttpResponse("Unauthorized", status_code=401)

    return func.HttpResponse(
        json.dumps({"email": email}),
        mimetype="application/json"
    )

def get_dataset_from_blob(filename):
    conn_str = os.environ["BLOB_CONNECTION_STRING"]
    container_name = "datafiles"

    blob_service_client = BlobServiceClient.from_connection_string(conn_str)
    blob_client = blob_service_client.get_blob_client(
        container=container_name,
        blob=filename
    )

    blob_data = blob_client.download_blob().readall()

    # Decode safely (handles BOM)
    text = blob_data.decode("utf-8-sig")

    csv_file = io.StringIO(text)

    # Auto-detect delimiter
    sample = csv_file.read(1024)
    csv_file.seek(0)

    dialect = csv.Sniffer().sniff(sample)
    reader = csv.DictReader(csv_file, dialect=dialect)

    return list(reader)