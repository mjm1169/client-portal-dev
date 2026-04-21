import azure.functions as func
import json
import base64

ALLOWED_EMAILS = {
    "matthewmason202@gmail.com",
    "matty.mason@ipsos.com",
    "m.mason@karianandbox.com"
}

def main(req: func.HttpRequest) -> func.HttpResponse:
    email = ""
    principal_header = req.headers.get("x-ms-client-principal", "")
    if principal_header:
        try:
            principal = json.loads(base64.b64decode(principal_header).decode("utf-8"))
            email = principal.get("userDetails", "").lower()
        except Exception:
            pass
    else:
        try:
            body = req.get_json()
            email = body.get("userDetails", "").lower()
        except Exception:
            pass

    if not email:
        return func.HttpResponse(
            json.dumps({"roles": []}),
            mimetype="application/json",
            status_code=200
        )

    roles = ["appUser"] if email in ALLOWED_EMAILS else []

    return func.HttpResponse(
        json.dumps({"roles": roles}),
        mimetype="application/json",
        status_code=200
    )
