"""
Punto de entrada del MCP Server.

Importa todos los módulos de tools para que registren sus herramientas,
luego arranca el servidor con transporte HTTP/SSE.

Endpoints expuestos:
  GET  /sse                      → stream SSE para el cliente MCP
  POST /messages/                → mensajes JSON-RPC del cliente hacia el servidor
  GET  /descargar/{nombre}       → descarga un archivo del directorio output/
  GET  /archivos                 → lista los archivos disponibles en output/
"""

import logging
from pathlib import Path

import uvicorn
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import FileResponse, JSONResponse
from starlette.routing import Mount, Route

from src.config import settings

# ── Configurar logging antes de importar tools ──────────────────────────────
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ── Importar tools (registro automático de @mcp.tool()) ─────────────────────
# Utilidades base (transversales a todo el proyecto)
import src.tools.archivos   # noqa: F401, E402
import src.tools.database   # noqa: F401, E402
import src.tools.apis       # noqa: F401, E402
import src.tools.datos      # noqa: F401, E402
import src.tools.reportes   # noqa: F401, E402

# Features de negocio (cada carpeta = una funcionalidad)
import src.tools.ppm        # noqa: F401, E402

from src.server import mcp  # noqa: E402

# ── Endpoints de descarga ────────────────────────────────────────────────────

_OUTPUT_ROOT = Path(settings.output_dir).resolve()


async def descargar_archivo(request: Request) -> FileResponse | JSONResponse:
    """Descarga un archivo del directorio output/. Ej: /descargar/ppm/reporte.pptx"""
    nombre = request.path_params["nombre"]

    # Solo permitir extensiones de archivo conocidas
    if not nombre.endswith((".pptx", ".pdf", ".xlsx")):
        return JSONResponse({"error": "Tipo de archivo no permitido"}, status_code=400)

    file_path = (_OUTPUT_ROOT / nombre).resolve()

    # Seguridad: no permitir salir del directorio output/
    if not str(file_path).startswith(str(_OUTPUT_ROOT)):
        return JSONResponse({"error": "Acceso denegado"}, status_code=403)

    if not file_path.exists():
        return JSONResponse({"error": f"Archivo no encontrado: {nombre}"}, status_code=404)

    return FileResponse(
        str(file_path),
        filename=file_path.name,
        media_type="application/octet-stream",
    )


async def listar_archivos(request: Request) -> JSONResponse:
    """Lista todos los archivos disponibles para descargar en output/."""
    archivos = []
    for ext in ("*.pptx", "*.pdf", "*.xlsx"):
        for f in sorted(_OUTPUT_ROOT.rglob(ext)):
            ruta_relativa = f.relative_to(_OUTPUT_ROOT)
            archivos.append({
                "nombre": f.name,
                "ruta": str(ruta_relativa),
                "url_descarga": f"/descargar/{ruta_relativa.as_posix()}",
                "tamaño_kb": round(f.stat().st_size / 1024, 1),
            })
    return JSONResponse(archivos)


if __name__ == "__main__":
    logger.info(
        "Iniciando %s en http://%s:%d (transporte SSE)",
        settings.mcp_server_name,
        settings.mcp_host,
        settings.mcp_port,
    )

    app = Starlette(routes=[
        Route("/descargar/{nombre:path}", descargar_archivo),
        Route("/archivos", listar_archivos),
        Mount("/", app=mcp.sse_app()),
    ])

    uvicorn.run(
        app,
        host=settings.mcp_host,
        port=settings.mcp_port,
    )
