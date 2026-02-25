import json
import os
import base64
import csv
import azure.functions as func


def main(req: func.HttpRequest) -> func.HttpResponse:

    # Get requested dataset
    dataset = req.params.get("ds")

    if not dataset:
        return func.HttpResponse(
            "Missing dataset",
            status_code=400
        )

    # Get user identity
    client = req.headers.get("x-ms-client-principal")

    if not client:
        return func.HttpResponse("Not authenticated", status_code=401)

    user = json.loads(base64.b64decode(client))
    email = user.get("userDetails").lower()

    # Load access config
    base = os.path.dirname(__file__)
    config_path = os.path.abspath(
        os.path.join(base, "..", "config", "user_access.json")
    )

    with open(config_path) as f:
        access = json.load(f)

    allowed = []

    if email in access.get("users", {}):
        allowed = access["users"][email]["datasets"]

    if dataset not in allowed:
        return func.HttpResponse("Forbidden", status_code=403)

    # Load CSV
    data_path = os.path.abspath(
        os.path.join(base, "..", "datafiles", f"{dataset}.csv")
    )

    if not os.path.exists(data_path):
        return func.HttpResponse("Not found", status_code=404)

    rows = []

    with open(data_path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)

    return func.HttpResponse(
        json.dumps(rows),
        mimetype="application/json"
    )
