"""
Punto de entrada del MCP Server.

Importa todos los módulos de tools para que registren sus herramientas,
luego arranca el servidor con transporte HTTP/SSE.

Endpoints expuestos:
  GET  /sse       → stream SSE para el cliente MCP
  POST /messages/ → mensajes JSON-RPC del cliente hacia el servidor
"""

import logging

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

if __name__ == "__main__":
    logger.info(
        "Iniciando %s en http://%s:%d (transporte SSE)",
        settings.mcp_server_name,
        settings.mcp_host,
        settings.mcp_port,
    )
    mcp.run(
        transport="sse",
        host=settings.mcp_host,
        port=settings.mcp_port,
    )
