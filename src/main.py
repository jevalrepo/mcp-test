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
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import FileResponse, JSONResponse
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles

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
    if not nombre.endswith((".pptx", ".pdf", ".xlsx", ".csv")):
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
    for ext in ("*.pptx", "*.pdf", ".xlsx", "*.csv"):
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
    from src.api.ppm.proyectos import (
        list_proyectos, get_proyecto, create_proyecto, update_proyecto,
        delete_proyecto, get_historial, get_estadisticas,
    )
    from src.api.ppm.actividades import (
        list_actividades, create_actividad, update_actividad, delete_actividad,
    )
    from src.api.ppm.riesgos import (
        list_riesgos, create_riesgo, update_riesgo, delete_riesgo,
    )
    from src.api.ppm.etapas import (
        list_etapas, create_etapa, update_etapa, delete_etapa,
    )
    from src.api.ppm.presentaciones import (
        list_presentaciones, generar_presentacion, eliminar_presentacion,
    )

    logger.info(
        "Iniciando %s en http://%s:%d (transporte SSE)",
        settings.mcp_server_name,
        settings.mcp_host,
        settings.mcp_port,
    )

    # Rutas estáticas del admin (frontend React compilado)
    _frontend_dist = Path("frontend/dist")
    _admin_routes = []
    if _frontend_dist.exists():
        _admin_routes = [
            Mount("/assets", app=StaticFiles(directory=str(_frontend_dist / "assets"))),
            Mount("/ppm", app=StaticFiles(directory=str(_frontend_dist), html=True)),
        ]

    middleware = [
        Middleware(
            CORSMiddleware,
            allow_origins=["http://localhost:5173", "http://localhost:3000"],
            allow_methods=["*"],
            allow_headers=["*"],
        )
    ]

    app = Starlette(
        middleware=middleware,
        routes=[
            # ── Archivos ─────────────────────────────────────────────────
            Route("/descargar/{nombre:path}", descargar_archivo),
            Route("/archivos", listar_archivos),

            # ── API PPM — Proyectos ───────────────────────────────────────
            Route("/api/ppm/proyectos", list_proyectos, methods=["GET"]),
            Route("/api/ppm/proyectos", create_proyecto, methods=["POST"]),
            Route("/api/ppm/proyectos/{folio}", get_proyecto, methods=["GET"]),
            Route("/api/ppm/proyectos/{folio}", update_proyecto, methods=["PUT"]),
            Route("/api/ppm/proyectos/{folio}", delete_proyecto, methods=["DELETE"]),

            # ── API PPM — Actividades ─────────────────────────────────────
            Route("/api/ppm/actividades", list_actividades, methods=["GET"]),
            Route("/api/ppm/actividades", create_actividad, methods=["POST"]),
            Route("/api/ppm/actividades/{id:int}", update_actividad, methods=["PUT"]),
            Route("/api/ppm/actividades/{id:int}", delete_actividad, methods=["DELETE"]),

            # ── API PPM — Riesgos ─────────────────────────────────────────
            Route("/api/ppm/riesgos", list_riesgos, methods=["GET"]),
            Route("/api/ppm/riesgos", create_riesgo, methods=["POST"]),
            Route("/api/ppm/riesgos/{id:int}", update_riesgo, methods=["PUT"]),
            Route("/api/ppm/riesgos/{id:int}", delete_riesgo, methods=["DELETE"]),

            # ── API PPM — Etapas ──────────────────────────────────────────
            Route("/api/ppm/etapas", list_etapas, methods=["GET"]),
            Route("/api/ppm/etapas", create_etapa, methods=["POST"]),
            Route("/api/ppm/etapas/{id:int}", update_etapa, methods=["PUT"]),
            Route("/api/ppm/etapas/{id:int}", delete_etapa, methods=["DELETE"]),

            # ── API PPM — Historial y estadísticas ────────────────────────
            Route("/api/ppm/historial/{folio}", get_historial, methods=["GET"]),
            Route("/api/ppm/estadisticas", get_estadisticas, methods=["GET"]),

            # ── API PPM — Presentaciones PPTX ────────────────────────────
            Route("/api/ppm/presentaciones", list_presentaciones, methods=["GET"]),
            Route("/api/ppm/presentaciones", generar_presentacion, methods=["POST"]),
            Route("/api/ppm/presentaciones/{nombre}", eliminar_presentacion, methods=["DELETE"]),

            # ── Admin UI (React build) ────────────────────────────────────
            *_admin_routes,

            # ── MCP SSE ───────────────────────────────────────────────────
            Mount("/", app=mcp.sse_app()),
        ],
    )

    uvicorn.run(
        app,
        host=settings.mcp_host,
        port=settings.mcp_port,
    )
