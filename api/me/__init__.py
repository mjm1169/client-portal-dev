""" import base64
import json
import azure.functions as func


def get_user(req: func.HttpRequest):
    header = req.headers.get("x-ms-client-principal")

    # Real Azure auth
    if header:
        decoded_bytes = base64.b64decode(header)
        decoded_json = json.loads(decoded_bytes)
        return decoded_json.get("userDetails")

    # If running locally (SWA CLI), hostname will be localhost
    if "localhost" in req.url:
        return "matthew.test@local.dev"

    return None


def main(req: func.HttpRequest) -> func.HttpResponse:
    email = get_user(req)

    if not email:
        return func.HttpResponse("Unauthorized", status_code=401)

    return func.HttpResponse(
        json.dumps({"email": email}),
        status_code=200,
        mimetype="application/json"
    ) """

import azure.functions as func

def main(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse("PYTHON FUNCTION IS RUNNING")