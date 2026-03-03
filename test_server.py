"""
Script de prueba del servidor MCP via SSE.
Requiere que el servidor esté corriendo:

    python -m src.main          (en otra terminal)

Luego ejecutar este script:

    python test_server.py
"""

import asyncio
import sys

# ── Intenta importar el SDK de MCP ───────────────────────────────────────────
try:
    from mcp.client.sse import sse_client
    from mcp import ClientSession
except ImportError:
    print("ERROR: instala las dependencias primero:")
    print("  pip install -r requirements.txt")
    sys.exit(1)

SERVER_URL = "http://localhost:8000/sse"


async def main():
    print("=" * 50)
    print(f"Conectando a {SERVER_URL} ...")
    print("=" * 50)

    try:
        async with sse_client(SERVER_URL) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                print("  Conectado OK\n")

                # ── Listar todos los tools disponibles ───────────────────────
                print("Tools registrados en el servidor:")
                result = await session.list_tools()
                for tool in result.tools:
                    print(f"  • {tool.name}")

                print()

                # ── Llamar a listar_proyectos_ppm ────────────────────────────
                print("Llamando a listar_proyectos_ppm ...")
                result = await session.call_tool("listar_proyectos_ppm", {})
                proyectos = result.content[0].text if result.content else "[]"
                print(f"  Respuesta: {proyectos[:300]}...")

                print()

                # ── Llamar a generar_presentacion_ppm ────────────────────────
                print("Llamando a generar_presentacion_ppm ...")
                result = await session.call_tool(
                    "generar_presentacion_ppm",
                    {"nombre_archivo": "test_desde_servidor"},
                )
                print(f"  Respuesta: {result.content[0].text if result.content else 'vacío'}")

    except ConnectionRefusedError:
        print("ERROR: No se pudo conectar. ¿Está corriendo el servidor?")
        print("  Ejecuta en otra terminal: python -m src.main")
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
