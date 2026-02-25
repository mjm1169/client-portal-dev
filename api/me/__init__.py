import json
import os
import base64
import azure.functions as func


def main(req: func.HttpRequest) -> func.HttpResponse:

    client_principal = req.headers.get("x-ms-client-principal")

    if not client_principal:
        return func.HttpResponse(
            json.dumps({"error": "Not authenticated"}),
            status_code=401,
            mimetype="application/json"
        )

    # Decode Azure identity
    decoded = base64.b64decode(client_principal)
    user = json.loads(decoded)

    email = user.get("userDetails").lower()

    # Load access config
    base_path = os.path.dirname(__file__)
    config_path = os.path.abspath(
        os.path.join(base_path, "..", "config", "user_access.json")
    )

    if not os.path.exists(config_path):
        return func.HttpResponse(
            json.dumps({"error": "Access config missing"}),
            status_code=500,
            mimetype="application/json"
        )

    with open(config_path, "r", encoding="utf-8") as f:
        access = json.load(f)

    user_config = access.get("users", {}).get(email)

    if not user_config:
        return func.HttpResponse(
            json.dumps({"error": "No access assigned"}),
            status_code=403,
            mimetype="application/json"
        )

    response = {
        "email": email,
        "role": user_config.get("role"),
        "pages": user_config.get("pages", []),
        "datasets": user_config.get("datasets", []),
        "reports": user_config.get("reports", [])
    }

    return func.HttpResponse(
        json.dumps(response),
        mimetype="application/json",
        status_code=200
    )
