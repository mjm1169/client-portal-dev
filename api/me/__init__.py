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
    # In development, ODBC Driver 18 for SQL Server may not be installed locally.
    # We skip the DB call and return a hardcoded record so the rest of the app
    # (blob fetch, tree build, filter) can still be exercised end-to-end.
    if APP_ENV == "development":
        return [
            {"project": "project1", "role": "/NHS"},
            {"project": "project2", "role": "/Zippy"}
        ]

    conn = get_sql_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT project, role FROM UserDatasetAccess WHERE email = ?",
        email
    )

    rows = cursor.fetchall()

    if not rows:
        return []

    return [{"project": row[0], "role": row[1]} for row in rows]

# -----------------------------------
# DATASET ACCESS (SQL optional)
# -----------------------------------
def get_sql_connection():
    import pyodbc
    conn_str = os.environ["SQL_CONNECTION_STRING"]
    return pyodbc.connect(conn_str)

def log_access(email, project, outcome):
    if APP_ENV == "development":
        return
    try:
        conn = get_sql_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO AuditLog (email, project, outcome) VALUES (?, ?, ?)",
            email, project, outcome
        )
        conn.commit()
    except Exception:
        logging.exception("Failed to write audit log")
    logging.info(pyodbc.drivers())


# -----------------------------------
# BLOB ACCESS
# -----------------------------------
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

    # role is now a hierarchy path e.g. "/NHS/NHS England"
    def find_node(n):
        if n.get("path") == role:
            return n

        for child in n.get("children", []):
            result = find_node(child)
            if result:
                return result

        return None

    return find_node(node)

# -----------------------------------
# SCORE LABELS
# -----------------------------------
def extract_labels(rows):
    """Remove the __labels__ row from rows in-place and return a {col: label} map."""
    for i, row in enumerate(rows):
        if row.get("Level0", "").strip() == "__labels__":
            label_map = {
                key: val.strip()
                for key, val in row.items()
                if val and val.strip() and key.lower().startswith("score")
            }
            rows.pop(i)
            return label_map
    return {}

def build_scores_list(rows, label_map):
    """Return [{id, label}] for every score column, using label_map or falling back to the column name."""
    if not rows:
        return []
    score_columns = [col for col in rows[0].keys() if col.lower().startswith("score")]
    return [{"id": sc, "label": label_map.get(sc, sc)} for sc in score_columns]

# -----------------------------------
# MAIN
# -----------------------------------
def main(req: func.HttpRequest) -> func.HttpResponse:
    try:
        email = get_user_email(req)

        if not email:
            return func.HttpResponse("Unauthorized", status_code=401)

        access_list = get_user_access(email)

        if not access_list:
            log_access(email, None, "forbidden_no_access")
            return func.HttpResponse("Forbidden", status_code=403)

        # If the user has multiple projects, the frontend can request a specific
        # one via ?project=. Default to the first assigned project.
        requested = req.params.get("project")
        if requested:
            access = next((a for a in access_list if a["project"] == requested), None)
            if not access:
                log_access(email, requested, "forbidden_wrong_project")
                return func.HttpResponse("Forbidden", status_code=403)
        else:
            access = access_list[0]

        project_id = access["project"]
        role = access["role"]

        hierarchy_file = f"{project_id}/data.csv"

        rows = get_csv_from_blob(hierarchy_file)
        label_map = extract_labels(rows)
        scores = build_scores_list(rows, label_map)

        tree = build_tree(rows)
        filtered_tree = filter_tree(tree, role)

        log_access(email, project_id, "success")

        return func.HttpResponse(
            json.dumps({
                "tree": filtered_tree,
                "scores": scores,
                "projects": [a["project"] for a in access_list],
                "currentProject": project_id
            }),
            status_code=200,
            mimetype="application/json"
        )

    except Exception as exc:
        logging.exception("Unhandled exception in /api/me")

        body = {"error": "Internal server error"}
        if APP_ENV == "development":
            import traceback
            body["detail"] = traceback.format_exc()

        return func.HttpResponse(
            json.dumps(body),
            status_code=500,
            mimetype="application/json"
        )