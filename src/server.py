"""
Instancia central del servidor MCP.

Todos los módulos de tools importan `mcp` desde aquí para registrar
sus herramientas con el decorador @mcp.tool().
"""

from mcp.server.fastmcp import FastMCP

from src.config import settings

mcp = FastMCP(
    name=settings.mcp_server_name,
    # Instrucciones que el LLM recibe sobre este servidor
    instructions=(
        "Servidor MCP con herramientas para manejo de archivos, base de datos, "
        "consultas a APIs externas, procesamiento de datos y generación de reportes PDF."
    ),
)
