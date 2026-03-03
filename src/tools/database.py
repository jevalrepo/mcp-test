"""
Tool: Database
Operaciones contra la base de datos configurada en DATABASE_URL.
Usa SQLAlchemy async para compatibilidad con PostgreSQL y SQLite.
"""

from typing import Annotated, Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from src.config import settings
from src.server import mcp

# ── Engine y sesión ──────────────────────────────────────────────────────────

_engine = create_async_engine(settings.database_url, echo=False)
_AsyncSession = sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)


async def _get_session() -> AsyncSession:
    return _AsyncSession()


# ── Tools ────────────────────────────────────────────────────────────────────


@mcp.tool()
async def ejecutar_consulta(
    sql: Annotated[str, "Sentencia SQL a ejecutar (SELECT, INSERT, UPDATE, DELETE)"],
    parametros: Annotated[dict[str, Any] | None, "Parámetros nombrados (:nombre) para la consulta"] = None,
) -> list[dict]:
    """
    Ejecuta una sentencia SQL con parámetros opcionales.
    Para SELECT devuelve las filas como lista de diccionarios.
    Para DML devuelve [{'filas_afectadas': N}].
    """
    async with _AsyncSession() as session:
        result = await session.execute(text(sql), parametros or {})
        await session.commit()

        if result.returns_rows:
            keys = list(result.keys())
            return [dict(zip(keys, row)) for row in result.fetchall()]
        return [{"filas_afectadas": result.rowcount}]


@mcp.tool()
async def insertar_registro(
    tabla: Annotated[str, "Nombre de la tabla"],
    datos: Annotated[dict[str, Any], "Diccionario columna→valor a insertar"],
) -> dict:
    """Inserta un registro en la tabla especificada. Devuelve las filas afectadas."""
    columnas = ", ".join(datos.keys())
    valores = ", ".join(f":{k}" for k in datos.keys())
    sql = f"INSERT INTO {tabla} ({columnas}) VALUES ({valores})"  # noqa: S608

    async with _AsyncSession() as session:
        result = await session.execute(text(sql), datos)
        await session.commit()
        return {"tabla": tabla, "filas_insertadas": result.rowcount}


@mcp.tool()
async def actualizar_registro(
    tabla: Annotated[str, "Nombre de la tabla"],
    datos: Annotated[dict[str, Any], "Columnas y valores a actualizar"],
    condicion: Annotated[str, "Cláusula WHERE sin la palabra WHERE (ej. 'id = :id')"],
    parametros_condicion: Annotated[dict[str, Any] | None, "Parámetros para la condición"] = None,
) -> dict:
    """Actualiza registros en la tabla que cumplan la condición."""
    set_clause = ", ".join(f"{k} = :upd_{k}" for k in datos.keys())
    params = {f"upd_{k}": v for k, v in datos.items()}
    if parametros_condicion:
        params.update(parametros_condicion)

    sql = f"UPDATE {tabla} SET {set_clause} WHERE {condicion}"  # noqa: S608

    async with _AsyncSession() as session:
        result = await session.execute(text(sql), params)
        await session.commit()
        return {"tabla": tabla, "filas_actualizadas": result.rowcount}


@mcp.tool()
async def eliminar_registro(
    tabla: Annotated[str, "Nombre de la tabla"],
    condicion: Annotated[str, "Cláusula WHERE sin la palabra WHERE (ej. 'id = :id')"],
    parametros: Annotated[dict[str, Any] | None, "Parámetros para la condición"] = None,
) -> dict:
    """Elimina registros de la tabla que cumplan la condición."""
    sql = f"DELETE FROM {tabla} WHERE {condicion}"  # noqa: S608

    async with _AsyncSession() as session:
        result = await session.execute(text(sql), parametros or {})
        await session.commit()
        return {"tabla": tabla, "filas_eliminadas": result.rowcount}


@mcp.tool()
async def listar_tablas() -> list[str]:
    """Devuelve la lista de tablas disponibles en la base de datos."""
    # Funciona en PostgreSQL y SQLite
    sql_pg = "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
    sql_lite = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"

    is_sqlite = settings.database_url.startswith("sqlite")
    sql = sql_lite if is_sqlite else sql_pg

    async with _AsyncSession() as session:
        result = await session.execute(text(sql))
        rows = result.fetchall()
        return [row[0] for row in rows]
