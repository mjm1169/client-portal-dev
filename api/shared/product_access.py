import os

from .db import get_sql_connection

APP_ENV = os.environ.get("APP_ENV", "production")

# Local dev fallback so gated endpoints can be exercised without a SQL connection.
_DEV_GRANTS = {
    ("local.user@company.com", "radial"): [
        {"client": "project1", "blob_name": "data.csv", "attribute1": "/NHS", "attribute2": None, "attribute3": None},
        {"client": "project2", "blob_name": "data.csv", "attribute1": "/Zippy", "attribute2": None, "attribute3": None},
    ],
    ("local.user@company.com", "scrollytelling"): [
        {"client": "Ippy", "blob_name": "ippy_scrollytelling_report.html", "attribute1": None, "attribute2": None, "attribute3": None},
    ],
    ("local.user@company.com", "industry_analytics"): [
        {"client": "General", "blob_name": "report_R1001.pdf", "attribute1": None, "attribute2": None, "attribute3": None},
    ],
}


def get_product_access(email, product):
    """Return this user's grants for `product` as a list of
    {client, blob_name, attribute1, attribute2, attribute3} dicts."""
    if APP_ENV == "development":
        return _DEV_GRANTS.get((email, product), [])

    conn = get_sql_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "SELECT client, blob_name, attribute1, attribute2, attribute3 "
            "FROM ProductAccess WHERE email = ? AND product = ?",
            (email, product)
        )
        rows = cursor.fetchall()
    finally:
        conn.close()

    return [
        {"client": r[0], "blob_name": r[1], "attribute1": r[2], "attribute2": r[3], "attribute3": r[4]}
        for r in rows
    ]
