import logging
import os

APP_ENV = os.environ.get("APP_ENV", "production")


def get_sql_connection():
    import pyodbc
    conn_str = os.environ["SQL_CONNECTION_STRING"]
    conn = pyodbc.connect(conn_str, timeout=10)
    conn.timeout = 30  # statement (query execution) timeout in seconds
    return conn


def log_access(email, resource, outcome, detail=None):
    if APP_ENV == "development":
        return
    outcome_value = f"{outcome}: {detail[:200]}" if detail else outcome
    try:
        conn = get_sql_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO AuditLog (email, project, outcome) VALUES (?, ?, ?)",
                (email, resource, outcome_value)
            )
            conn.commit()
        finally:
            conn.close()
    except Exception:
        logging.exception("Failed to write audit log")
