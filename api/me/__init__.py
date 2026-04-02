import azure.functions as func
import base64
import json
import os
import logging
from azure.storage.blob import BlobServiceClient
import csv
import io

# -----------------------------------
# ENVIRONMENT
# -----------------------------------
APP_ENV = os.environ.get("APP_ENV", "production")


# -----------------------------------
# AUTH
# -----------------------------------
def get_user_email(req):
    header = req.headers.get("x-ms-client-principal")

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
def get_user_access(email):
    return {
        "project": "project1",
        "role": "CEO"
    }

""" def get_user_access(email):

    if APP_ENV == "development":
        return {
            "project": "project1",
            "role": "CEO"
        }

    conn = get_sql_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT projectId, role FROM UserDatasetAccess WHERE email = ?",
        email
    )

    row = cursor.fetchone()

    if not row:
        return None

    return {
        "project": row[0],
        "role": row[1]
    } """

# -----------------------------------
# DATASET ACCESS (SQL optional)
# -----------------------------------
def get_sql_connection():
    import pyodbc
    conn_str = os.environ["SQL_CONNECTION_STRING"]
    return pyodbc.connect(conn_str)


""" def get_dataset_for_user(email):

    if APP_ENV == "development":
        return "data1.csv"

    conn = get_sql_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT projectId FROM UserDatasetAccess WHERE email = ?",
        #SELECT datasetFile FROM UserDatasetAccess WHERE email = ?,
        email
    )

    row = cursor.fetchone()
    return row[0] if row else None """

# -----------------------------------
# BLOB ACCESS
# -----------------------------------
""" def get_dataset_from_blob(filename):
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

    return list(reader) """
def get_csv_from_blob(blob_path):
    conn_str = os.environ["BLOB_CONNECTION_STRING"]
    container_name = os.environ["BLOB_CONTAINER_NAME"]

    blob_service_client = BlobServiceClient.from_connection_string(conn_str)
    blob_client = blob_service_client.get_blob_client(
        container=container_name,
        blob=blob_path
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
# BUILD TREE (matches your frontend)
# -----------------------------------
def build_tree(rows):

    root = {
        "name": "Root",
        "children": [],
        "path": ""
    }

    # detect score columns dynamically
    score_columns = [
        col for col in rows[0].keys()
        if col.lower().startswith("score")
    ]

    def get_or_create_child(parent, name):
        child = next((c for c in parent["children"] if c["name"] == name), None)

        if not child:
            child = {
                "name": name,
                "children": [],
                "scores": {},
                "size": 0,
                "path": parent["path"] + "/" + name
            }
            parent["children"].append(child)

        return child

    for row in rows:
        current = root

        # walk hierarchy
        for i in range(11):
            level = row.get(f"Level{i}")
            if not level:
                break

            current = get_or_create_child(current, level.strip())

        # accumulate size (important)
        row_size = float(row.get("size") or 0)
        current["size"] += row_size

        # assign scores
        for col in score_columns:
            val = row.get(col)
            if val not in (None, ""):
                current["scores"][col] = float(val)

    # remove size from non-leaf nodes
    def clean_sizes(node):
        if node.get("children"):
            node.pop("size", None)
            for child in node["children"]:
                clean_sizes(child)

    clean_sizes(root)

    return root["children"][0] if root["children"] else root


# -----------------------------------
# FILTER TREE BY ROLE
# -----------------------------------
def filter_tree(node, role):

    role_map = {
        "CEO": "/NHS",
        "CFO": "/NHS/NHS England/Region1",
        "HR": "/NHS/NHS England/Region1/Trust1"
    }

    allowed_path = role_map.get(role)

    # CEO sees full tree
    if role == "CEO":
        return node

    # Depth-first search to FIND the allowed node
    def find_node(n):
        if n.get("path") == allowed_path:
            return n

        for child in n.get("children", []):
            result = find_node(child)
            if result:
                return result

        return None

    return find_node(node)

# -----------------------------------
# FORMAT SCORE MAPPING
# -----------------------------------
def format_score_mapping(rows):
    return [
        {
            "id": row.get("QID"),
            "label": row.get("Qtext")
        }
        for row in rows
    ]

# -----------------------------------
# MAIN
# -----------------------------------
def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        email = get_user_email(req)

        if not email:
            return func.HttpResponse("Unauthorized", status_code=401)

        access = get_user_access(email)

        if not access:
            return func.HttpResponse("Forbidden", status_code=403)

        project_id = access["project"]
        role = access["role"]

        if not project_id:
            return func.HttpResponse("Forbidden", status_code=403)

        hierarchy_file = f"radial-project/{project_id}/data.csv"
        mapping_file   = f"radial-project/{project_id}/qText.csv"

        rows = get_csv_from_blob(hierarchy_file)
        mapping_rows = get_csv_from_blob(mapping_file)

        tree = build_tree(rows)
        filtered_tree = filter_tree(tree, role)

        return func.HttpResponse(
            json.dumps({
                "tree": filtered_tree,
                "scores": format_score_mapping(mapping_rows)
            }),
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
     

""" def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        rows = get_csv_from_blob("radial-project/project1/data.csv")

        return func.HttpResponse(
            json.dumps({
                "rows_loaded": len(rows)
            }),
            status_code=200,
            mimetype="application/json"
        )

    except Exception as e:
        return func.HttpResponse(
            json.dumps({"error": str(e)}),
            status_code=500
        ) """