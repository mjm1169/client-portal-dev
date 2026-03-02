import azure.functions as func
import base64
import json
import os
import pyodbc
import logging
from azure.storage.blob import BlobServiceClient
import csv
import io

def get_user_email(req: func.HttpRequest):
    header = req.headers.get("x-ms-client-principal")

    if not header:
        return None

    decoded = base64.b64decode(header)
    principal = json.loads(decoded)

    return principal.get("userDetails")

def get_sql_connection():
    conn_str = os.environ["SQL_CONNECTION_STRING"]
    return pyodbc.connect(conn_str)

def get_dataset_for_user(email):
    conn = get_sql_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT DatasetFile FROM UserDatasetAccess WHERE Email = ?",
        email
    )

    row = cursor.fetchone()
    conn.close()

    return row[0] if row else None

def main(req: func.HttpRequest) -> func.HttpResponse:
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
    )

def get_dataset_from_blob(filename):
    try:
        conn_str = os.environ["BLOB_CONNECTION_STRING"]
        container_name = "datafiles"

        blob_service_client = BlobServiceClient.from_connection_string(conn_str)
        blob_client = blob_service_client.get_blob_client(
            container=container_name,
            blob=filename
        )

        blob_data = blob_client.download_blob().readall()
        return {"blob_size": len(blob_data)}

    except Exception as e:
        return {"blob_error": str(e)}