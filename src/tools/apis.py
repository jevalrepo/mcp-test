"""
Tool: APIs
Consultas HTTP a servicios externos. Incluye un cliente genérico y
helpers específicos para la API de Banorte.
"""

from typing import Annotated, Any

import httpx

from src.config import settings
from src.server import mcp

# ── Cliente HTTP compartido ──────────────────────────────────────────────────

_DEFAULT_TIMEOUT = settings.banorte_timeout


def _get_client(timeout: int = _DEFAULT_TIMEOUT) -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=timeout)


# ── Tools genéricos ──────────────────────────────────────────────────────────


@mcp.tool()
async def http_get(
    url: Annotated[str, "URL completa del endpoint"],
    headers: Annotated[dict[str, str] | None, "Cabeceras HTTP adicionales"] = None,
    params: Annotated[dict[str, str] | None, "Query parameters"] = None,
    timeout: Annotated[int, "Timeout en segundos"] = _DEFAULT_TIMEOUT,
) -> dict:
    """Realiza una petición HTTP GET y devuelve status, headers y body."""
    async with _get_client(timeout) as client:
        response = await client.get(url, headers=headers or {}, params=params or {})
        return {
            "status_code": response.status_code,
            "headers": dict(response.headers),
            "body": _parse_body(response),
        }


@mcp.tool()
async def http_post(
    url: Annotated[str, "URL completa del endpoint"],
    body: Annotated[dict[str, Any] | None, "Cuerpo JSON de la petición"] = None,
    headers: Annotated[dict[str, str] | None, "Cabeceras HTTP adicionales"] = None,
    timeout: Annotated[int, "Timeout en segundos"] = _DEFAULT_TIMEOUT,
) -> dict:
    """Realiza una petición HTTP POST con cuerpo JSON."""
    async with _get_client(timeout) as client:
        response = await client.post(url, json=body or {}, headers=headers or {})
        return {
            "status_code": response.status_code,
            "headers": dict(response.headers),
            "body": _parse_body(response),
        }


@mcp.tool()
async def http_put(
    url: Annotated[str, "URL completa del endpoint"],
    body: Annotated[dict[str, Any] | None, "Cuerpo JSON de la petición"] = None,
    headers: Annotated[dict[str, str] | None, "Cabeceras HTTP adicionales"] = None,
    timeout: Annotated[int, "Timeout en segundos"] = _DEFAULT_TIMEOUT,
) -> dict:
    """Realiza una petición HTTP PUT con cuerpo JSON."""
    async with _get_client(timeout) as client:
        response = await client.put(url, json=body or {}, headers=headers or {})
        return {
            "status_code": response.status_code,
            "headers": dict(response.headers),
            "body": _parse_body(response),
        }


@mcp.tool()
async def http_delete(
    url: Annotated[str, "URL completa del endpoint"],
    headers: Annotated[dict[str, str] | None, "Cabeceras HTTP adicionales"] = None,
    timeout: Annotated[int, "Timeout en segundos"] = _DEFAULT_TIMEOUT,
) -> dict:
    """Realiza una petición HTTP DELETE."""
    async with _get_client(timeout) as client:
        response = await client.delete(url, headers=headers or {})
        return {
            "status_code": response.status_code,
            "headers": dict(response.headers),
            "body": _parse_body(response),
        }


# ── Tools específicos Banorte ─────────────────────────────────────────────────


def _banorte_headers() -> dict[str, str]:
    """Genera las cabeceras estándar de autenticación para la API de Banorte."""
    return {
        "Authorization": f"Bearer {settings.banorte_api_key}",
        "X-API-Secret": settings.banorte_api_secret,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


@mcp.tool()
async def banorte_get(
    endpoint: Annotated[str, "Ruta del endpoint relativa a la base URL (ej. '/v1/cuentas')"],
    params: Annotated[dict[str, str] | None, "Query parameters opcionales"] = None,
) -> dict:
    """
    Realiza una petición GET autenticada a la API de Banorte.
    Usa automáticamente las credenciales configuradas en las variables de entorno.
    """
    url = f"{settings.banorte_api_base_url.rstrip('/')}{endpoint}"
    async with _get_client() as client:
        response = await client.get(url, headers=_banorte_headers(), params=params or {})
        return {
            "status_code": response.status_code,
            "body": _parse_body(response),
        }


@mcp.tool()
async def banorte_post(
    endpoint: Annotated[str, "Ruta del endpoint relativa a la base URL"],
    payload: Annotated[dict[str, Any], "Cuerpo JSON del request"],
) -> dict:
    """
    Realiza una petición POST autenticada a la API de Banorte.
    Usa automáticamente las credenciales configuradas en las variables de entorno.
    """
    url = f"{settings.banorte_api_base_url.rstrip('/')}{endpoint}"
    async with _get_client() as client:
        response = await client.post(url, json=payload, headers=_banorte_headers())
        return {
            "status_code": response.status_code,
            "body": _parse_body(response),
        }


# ── Helpers internos ─────────────────────────────────────────────────────────


def _parse_body(response: httpx.Response) -> Any:
    """Intenta parsear JSON; si falla, devuelve texto plano."""
    content_type = response.headers.get("content-type", "")
    if "application/json" in content_type:
        try:
            return response.json()
        except Exception:
            pass
    return response.text
