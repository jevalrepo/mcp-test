import sqlite3
import time

from starlette.requests import Request
from starlette.responses import JSONResponse

from src.tools.ppm.db.database import get_db_path


READ_PREFIXES = ("select", "pragma", "with", "explain")
DDL_PREFIXES = ("create", "drop", "alter")


def _statement_verb(sql: str) -> str:
    stripped = sql.strip().lstrip("(")
    if not stripped:
        return ""
    return stripped.split(None, 1)[0].lower()


def _normalize_sql(sql: str) -> str:
    return (sql or "").strip()


async def execute_sql(request: Request) -> JSONResponse:
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"error": "Body JSON invalido"}, status_code=400)

    sql = _normalize_sql(str(body.get("sql") or ""))
    if not sql:
        return JSONResponse({"error": "sql es requerido"}, status_code=400)

    started = time.perf_counter()
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    try:
        cur.execute(sql)
        lowered = sql.lstrip().lower()
        verb = _statement_verb(sql)
        has_result_set = cur.description is not None

        if has_result_set:
            rows = cur.fetchall()
            columns = [c[0] for c in (cur.description or [])]
            data = [dict(r) for r in rows]
            if not lowered.startswith(READ_PREFIXES):
                conn.commit()
            elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
            return JSONResponse(
                {
                    "ok": True,
                    "type": "result_set",
                    "columns": columns,
                    "rows": data,
                    "row_count": len(data),
                    "execution_ms": elapsed_ms,
                }
            )

        conn.commit()
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        rowcount = cur.rowcount if cur.rowcount is not None else -1
        if verb in DDL_PREFIXES:
            message = f"Sentencia {verb.upper()} ejecutada correctamente"
        elif rowcount >= 0:
            message = f"{rowcount} filas afectadas"
        else:
            message = "Sentencia ejecutada correctamente"
        return JSONResponse(
            {
                "ok": True,
                "type": "mutation",
                "statement": verb,
                "affected_rows": rowcount if rowcount >= 0 else None,
                "last_insert_id": cur.lastrowid,
                "message": message,
                "execution_ms": elapsed_ms,
            }
        )
    except sqlite3.Error as ex:
        conn.rollback()
        elapsed_ms = round((time.perf_counter() - started) * 1000, 2)
        return JSONResponse(
            {
                "ok": False,
                "error": str(ex),
                "execution_ms": elapsed_ms,
            },
            status_code=400,
        )
    finally:
        cur.close()
        conn.close()
