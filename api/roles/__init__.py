import azure.functions as func
import json

def main(req: func.HttpRequest) -> func.HttpResponse:
    return func.HttpResponse(
        json.dumps({
            "roles": ["authenticated"]
        }),
        mimetype="application/json",
        status_code=200
    )