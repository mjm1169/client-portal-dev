import azure.functions as func
import base64
import json
import os
import pyodbc

def get_user_email(req: func.HttpRequest):
    header = req.headers.get("x-ms-client-principal")

    if not header:
        return None

    decoded = base64.b64decode(header)
    principal = json.loads(decoded)

    return principal.get("userDetails")

def get_sql_connection():
    server = os.environ["SQL_SERVER"]
    database = os.environ["SQL_DATABASE"]

    conn_str = (
        "Driver={ODBC Driver 18 for SQL Server};"
        f"Server=tcp:{server},1433;"
        f"Database={database};"
        "Encrypt=yes;"
        "TrustServerCertificate=no;"
        "Authentication=ActiveDirectoryManagedIdentity;"
    )

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

    email = get_user_email(req)

    if not email:
        return func.HttpResponse("Unauthorized", status_code=401)

    dataset_file = get_dataset_for_user(email)

    if not dataset_file:
        return func.HttpResponse("Forbidden", status_code=403)

    return func.HttpResponse(
        json.dumps({"datasetFile": dataset_file}),
        status_code=200,
        mimetype="application/json"
    )