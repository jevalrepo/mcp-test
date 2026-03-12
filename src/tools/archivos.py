"""
Tool: Archivos
Operaciones sobre el sistema de archivos dentro del directorio base permitido.
"""

import os
import shutil
from pathlib import Path
from typing import Annotated

from mcp.server.fastmcp import Context

from src.config import settings
from src.server import mcp

# ── Helpers ──────────────────────────────────────────────────────────────────

BASE_DIR = Path(settings.files_base_dir).resolve()


def _safe_path(ruta: str) -> Path:
    """Resuelve la ruta y valida que esté dentro de BASE_DIR."""
    path = (BASE_DIR / ruta).resolve()
    if not str(path).startswith(str(BASE_DIR)):
        raise ValueError(f"Acceso denegado: '{ruta}' está fuera del directorio permitido.")
    return path


# ── Tools ────────────────────────────────────────────────────────────────────


@mcp.tool()
def leer_archivo(
    ruta: Annotated[str, "Ruta relativa al directorio base (ej. 'reportes/datos.csv')"],
) -> str:
    """Lee y devuelve el contenido de un archivo de texto."""
    path = _safe_path(ruta)
    if not path.exists():
        raise FileNotFoundError(f"No existe el archivo: {ruta}")
    if not path.is_file():
        raise IsADirectoryError(f"'{ruta}' es un directorio, no un archivo.")
    return path.read_text(encoding="utf-8")


@mcp.tool()
def escribir_archivo(
    ruta: Annotated[str, "Ruta relativa donde guardar el archivo"],
    contenido: Annotated[str, "Contenido de texto a escribir"],
    sobrescribir: Annotated[bool, "Si True, sobreescribe el archivo si existe"] = False,
) -> str:
    """Escribe contenido de texto en un archivo. Crea los directorios intermedios si no existen."""
    path = _safe_path(ruta)
    if path.exists() and not sobrescribir:
        raise FileExistsError(f"El archivo '{ruta}' ya existe. Usa sobrescribir=True para reemplazarlo.")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(contenido, encoding="utf-8")
    return f"Archivo guardado: {ruta} ({path.stat().st_size} bytes)"


@mcp.tool()
def listar_directorio(
    ruta: Annotated[str, "Ruta relativa del directorio a listar ('' para el directorio raíz)"] = "",
) -> list[dict]:
    """Lista el contenido de un directorio. Devuelve nombre, tipo y tamaño de cada entrada."""
    path = _safe_path(ruta)
    if not path.exists():
        raise FileNotFoundError(f"No existe el directorio: {ruta}")
    if not path.is_dir():
        raise NotADirectoryError(f"'{ruta}' es un archivo, no un directorio.")

    entries = []
    for entry in sorted(path.iterdir()):
        stat = entry.stat()
        entries.append({
            "nombre": entry.name,
            "tipo": "directorio" if entry.is_dir() else "archivo",
            "tamaño_bytes": stat.st_size if entry.is_file() else None,
            "ruta_relativa": str(entry.relative_to(BASE_DIR)),
        })
    return entries


@mcp.tool()
def buscar_archivos(
    patron: Annotated[str, "Patrón glob (ej. '*.csv', '**/*.json')"],
    directorio: Annotated[str, "Directorio de búsqueda relativo al base ('') para todo"] = "",
) -> list[str]:
    """Busca archivos que coincidan con un patrón glob. Devuelve rutas relativas."""
    path = _safe_path(directorio)
    if not path.is_dir():
        raise NotADirectoryError(f"'{directorio}' no es un directorio.")
    return [str(p.relative_to(BASE_DIR)) for p in path.glob(patron) if p.is_file()]


@mcp.tool()
def eliminar_archivo(
    ruta: Annotated[str, "Ruta relativa del archivo a eliminar"],
) -> str:
    """Elimina un archivo. No elimina directorios."""
    path = _safe_path(ruta)
    if not path.exists():
        raise FileNotFoundError(f"No existe: {ruta}")
    if path.is_dir():
        raise IsADirectoryError(f"'{ruta}' es un directorio. Usa eliminar_directorio.")
    path.unlink()
    return f"Archivo eliminado: {ruta}"


@mcp.tool()
def mover_archivo(
    origen: Annotated[str, "Ruta relativa del archivo origen"],
    destino: Annotated[str, "Ruta relativa del destino"],
) -> str:
    """Mueve o renombra un archivo dentro del directorio base."""
    src = _safe_path(origen)
    dst = _safe_path(destino)
    if not src.exists():
        raise FileNotFoundError(f"No existe el origen: {origen}")
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src), str(dst))
    return f"Movido: '{origen}' → '{destino}'"


@mcp.tool()
def buscar_en_archivos(
    texto: Annotated[str, "Texto o expresión a buscar dentro de los archivos"],
    directorio: Annotated[str, "Directorio de búsqueda relativo al base ('' para todo)"] = "",
    extension: Annotated[str, "Filtrar por extensión sin punto (ej. 'csv', 'txt'). Vacío = todos"] = "",
    max_resultados: Annotated[int, "Número máximo de coincidencias a devolver"] = 50,
    ignorar_mayusculas: Annotated[bool, "Si True, la búsqueda no distingue mayúsculas"] = True,
) -> dict:
    """Busca texto dentro del contenido de archivos. Devuelve archivo, línea y contexto de cada coincidencia."""
    import re

    path = _safe_path(directorio)
    if not path.is_dir():
        raise NotADirectoryError(f"'{directorio}' no es un directorio.")

    patron_glob = f"**/*.{extension}" if extension else "**/*"
    flags = re.IGNORECASE if ignorar_mayusculas else 0

    try:
        regex = re.compile(re.escape(texto), flags)
    except re.error as e:
        raise ValueError(f"Texto de búsqueda inválido: {e}")

    resultados = []
    archivos_revisados = 0
    archivos_con_coincidencia = 0

    for archivo in sorted(path.glob(patron_glob)):
        if not archivo.is_file():
            continue
        try:
            contenido = archivo.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        archivos_revisados += 1
        encontrado_en_archivo = False

        for num_linea, linea in enumerate(contenido.splitlines(), start=1):
            if len(resultados) >= max_resultados:
                break
            if regex.search(linea):
                if not encontrado_en_archivo:
                    encontrado_en_archivo = True
                    archivos_con_coincidencia += 1
                resultados.append({
                    "archivo": str(archivo.relative_to(BASE_DIR)),
                    "linea": num_linea,
                    "contenido": linea.strip(),
                })

        if len(resultados) >= max_resultados:
            break

    return {
        "texto_buscado": texto,
        "archivos_revisados": archivos_revisados,
        "archivos_con_coincidencia": archivos_con_coincidencia,
        "total_coincidencias": len(resultados),
        "limite_alcanzado": len(resultados) >= max_resultados,
        "resultados": resultados,
    }
