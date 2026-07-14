import azure.functions as func
import json
import os
import logging
import csv
import io

from shared.auth import get_user_email
from shared.blob import download_blob_text
from shared.db import log_access
from shared.product_access import get_product_access

# -----------------------------------
# ENVIRONMENT
# -----------------------------------
APP_ENV = os.environ.get("APP_ENV", "production")


def get_user_access(email):
    # ProductAccess.client -> "project", .attribute1 -> "role" (radial's hierarchy-path
    # filter), .blob_name -> the blob's name within that client's folder.
    grants = get_product_access(email, "radial")
    return [
        {"project": g["client"], "role": g["attribute1"], "blob_name": g["blob_name"]}
        for g in grants
    ]

# -----------------------------------
# BLOB ACCESS
# -----------------------------------
def get_csv_from_blob(blob_path):
    text = download_blob_text(blob_path)
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
            log_access("unknown", None, "unauthorized")
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

        hierarchy_file = f"{project_id}/{access['blob_name']}"

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

        detail = f"{type(exc).__name__}: {exc}"
        log_access(
            locals().get("email") or "unknown",
            locals().get("project_id"),
            "error",
            detail
        )

        body = {"error": "Internal server error"}
        if APP_ENV == "development":
            import traceback
            body["detail"] = traceback.format_exc()

        return func.HttpResponse(
            json.dumps(body),
            status_code=500,
            mimetype="application/json"
        )