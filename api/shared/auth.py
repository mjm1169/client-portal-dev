import base64
import json
import os

APP_ENV = os.environ.get("APP_ENV", "production")


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
