import azure.functions as func
import json
import base64

ALLOWED_EMAILS = {
    "matthewmason202@gmail.com",
    "matty.mason@ipsos.com",
    "m.mason@karianandbox.com"
}

def main(req: func.HttpRequest) -> func.HttpResponse:
    # TEMP DIAGNOSTIC: always return appUser to test if rolesSource mechanism works
    return func.HttpResponse(
        json.dumps({"roles": ["appUser"]}),
        mimetype="application/json",
        status_code=200
    )
