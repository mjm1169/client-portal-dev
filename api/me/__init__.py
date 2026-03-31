import azure.functions as func
import base64
import json
import os
import logging
from azure.storage.blob import BlobServiceClient
import csv
import io

# -----------------------------------
# ENVIRONMENT FLAG
# -----------------------------------
# Set this in:
# local.settings.json → "APP_ENV": "development"
# Azure → "APP_ENV": "production"
APP_ENV = os.environ.get("APP_ENV", "production")


# -----------------------------------
# AUTH
# -----------------------------------
def get_user_email(req):
    header = req.headers.get("x-ms-client-principal")

    # LOCAL DEV MODE ONLY
    if not header:
        if APP_ENV == "development":
            return "local.user@company.com"
        return None

    try:
        decoded = base64.b64decode(header)
        principal = json.loads(decoded)
        email = principal.get("userDetails")

        if not email or "@" not in email:
            return None

        return email.lower()

    except Exception:
        return None


# -----------------------------------
# SQL ACCESS
# -----------------------------------
def get_sql_connection():
    import pyodbc
    conn_str = os.environ["SQL_CONNECTION_STRING"]
    return pyodbc.connect(conn_str)


def get_dataset_for_user(email):

    # LOCAL DEV OPTION (safe version)
    # -----------------------------------
    # Option A (recommended): use real SQL locally
    # Option B: fallback dataset for quick testing

    if APP_ENV == "development":
        # 👉 COMMENT THIS OUT once you want real SQL locally
        return "data1.csv"

    # PRODUCTION (always enforced)
    conn = get_sql_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT datasetFile FROM UserDatasetAccess WHERE email = ?",
        email
    )

    row = cursor.fetchone()
    return row[0] if row else None


# -----------------------------------
# BLOB ACCESS
# -----------------------------------
def get_dataset_from_blob(filename):
    conn_str = os.environ["BLOB_CONNECTION_STRING"]
    container_name = os.environ["BLOB_CONTAINER_NAME"]

    blob_service_client = BlobServiceClient.from_connection_string(conn_str)
    blob_client = blob_service_client.get_blob_client(
        container=container_name,
        blob=filename
    )

    blob_data = blob_client.download_blob().readall()

    text = blob_data.decode("utf-8-sig")
    csv_file = io.StringIO(text)

    sample = csv_file.read(1024)
    csv_file.seek(0)

    dialect = csv.Sniffer().sniff(sample)
    reader = csv.DictReader(csv_file, dialect=dialect)

    return list(reader)


# -----------------------------------
# MAIN FUNCTION
# -----------------------------------
def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        email = get_user_email(req)

        if not email:
            return func.HttpResponse("Unauthorized", status_code=401)

        dataset_file = get_dataset_for_user(email)

        if not dataset_file:
            return func.HttpResponse("Forbidden", status_code=403)

        logging.info(f"User {email} accessing dataset {dataset_file}")

        data = get_dataset_from_blob(dataset_file)

        return func.HttpResponse(
            json.dumps(data),
            status_code=200,
            mimetype="application/json"
        )

    except Exception:
        logging.exception("Unhandled exception in /api/me")

        return func.HttpResponse(
            json.dumps({"error": "Internal server error"}),
            status_code=500,
            mimetype="application/json"
        )