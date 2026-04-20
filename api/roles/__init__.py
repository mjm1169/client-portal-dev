import azure.functions as func
import json
import base64

ALLOWED_EMAILS = {
    "matthewmason202@gmail.com",
    "matty.mason@ipsos.com",
    "m.mason@karianandbox.com"
}

def main(req: func.HttpRequest) -> func.HttpResponse:
    principal_header = req.headers.get("x-ms-client-principal", "")
    if not principal_header:
        return func.HttpResponse(
            json.dumps({"roles": []}),
            mimetype="application/json",
            status_code=200
        )

    try:
        principal = json.loads(base64.b64decode(principal_header).decode("utf-8"))
        email = principal.get("userDetails", "").lower()
    except Exception:
        return func.HttpResponse(
            json.dumps({"roles": []}),
            mimetype="application/json",
            status_code=200
        )

    roles = ["authenticated"] if email in ALLOWED_EMAILS else []

    return func.HttpResponse(
        json.dumps({"roles": roles}),
        mimetype="application/json",
        status_code=200
    )
