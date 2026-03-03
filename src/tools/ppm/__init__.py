"""
Feature: PPM (Project Portfolio Management)
============================================
Genera presentaciones PowerPoint de seguimiento de proyectos
a partir de una plantilla Excel con tres hojas de datos:
  - RESUMEN  → un registro por proyecto
  - GANTT    → actividades con fechas y avance
  - RIESGOS  → riesgos por proyecto
  - ETAPAS   → estado de cada etapa del ciclo de vida

Archivos de la feature:
  src/tools/ppm/
    __init__.py      ← este archivo: define los @mcp.tool()
    excel_reader.py  ← lógica interna: lee y parsea el Excel
    ppt_writer.py    ← lógica interna: construye el PPTX

Datos / plantillas:
  data/ppm/
    master.pptx          ← template visual de PowerPoint
    plantilla_ppm.xlsx   ← Excel con los datos de proyectos
"""

from datetime import datetime
from pathlib import Path
from typing import Annotated

from src.config import settings
from src.server import mcp
from src.tools.ppm.excel_reader import read_all_projects
from src.tools.ppm.ppt_writer import build_ppt_multi

# ── Rutas de la feature ──────────────────────────────────────────────────────
# Todos los archivos de esta feature viven bajo data/ppm/ y output/ppm/

_DATA_DIR = Path(settings.files_base_dir) / "ppm"
_OUTPUT_DIR = Path(settings.output_dir) / "ppm"
_DEFAULT_EXCEL = _DATA_DIR / "plantilla_ppm.xlsx"
_DEFAULT_TEMPLATE = _DATA_DIR / "master.pptx"
_GEN_PREFIX = "gen_gantt_"


def _ensure_output():
    """Crea la carpeta de salida si no existe."""
    _OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def _is_active(valor) -> bool:
    """Interpreta el campo 'activo' del Excel (acepta 1/S/Si/True/Yes y sus contrarios)."""
    if valor is None:
        return True
    if isinstance(valor, bool):
        return valor
    return str(valor).strip().upper() not in ("0", "N", "NO", "FALSE")


# ── Tools MCP ────────────────────────────────────────────────────────────────


@mcp.tool()
def generar_presentacion_ppm(
    nombre_archivo: Annotated[
        str, "Nombre del PPTX de salida, sin extensión (ej. 'reporte_marzo')"
    ] = "salida_proyectos",
    excel_path: Annotated[
        str,
        "Ruta relativa al Excel PPM dentro de FILES_BASE_DIR. "
        "Si se omite, usa 'ppm/plantilla_ppm.xlsx'.",
    ] = "",
    solo_activos: Annotated[
        bool, "Si True omite proyectos donde activo=0/N/No. Default: True"
    ] = True,
) -> str:
    """
    Genera una presentación PowerPoint con un slide por proyecto.

    Cada slide incluye:
    - Encabezado con folio, nombre, objetivo y métricas del proyecto
    - Diagrama de Gantt dibujado programáticamente con barra de hoy
    - Íconos de estado por etapa del ciclo de vida
    - Tabla de riesgos

    Lee los datos desde el Excel PPM y usa master.pptx como plantilla visual.
    El archivo generado se guarda en output/ppm/<nombre_archivo>.pptx.
    """
    _ensure_output()

    excel = Path(settings.files_base_dir) / (excel_path or "ppm/plantilla_ppm.xlsx")

    if not excel.exists():
        raise FileNotFoundError(
            f"No encontré el Excel en: {excel}\n"
            f"Asegúrate de que el archivo esté en data/ppm/ o pasa la ruta correcta."
        )
    if not _DEFAULT_TEMPLATE.exists():
        raise FileNotFoundError(
            f"No encontré la plantilla PPTX en: {_DEFAULT_TEMPLATE}\n"
            f"El archivo master.pptx debe estar en data/ppm/."
        )

    # 1. Leer todos los proyectos del Excel
    projects = read_all_projects(str(excel))
    total = len(projects)

    # 2. Filtrar inactivos si aplica
    if solo_activos:
        projects = [(r, g, ri) for r, g, ri in projects if _is_active(getattr(r, "activo", 1))]
    omitidos = total - len(projects)

    # 3. Generar el PPTX
    out_file = _OUTPUT_DIR / f"{nombre_archivo}.pptx"
    build_ppt_multi(
        template_path=str(_DEFAULT_TEMPLATE),
        out_path=str(out_file),
        projects=projects,
        etapas_excel_path=str(excel),
        gen_prefix=_GEN_PREFIX,
    )

    ruta = str(Path("output") / "ppm" / f"{nombre_archivo}.pptx")
    return (
        f"Presentación generada: {ruta}\n"
        f"  Proyectos incluidos: {len(projects)}\n"
        f"  Proyectos omitidos (inactivos): {omitidos}"
    )


@mcp.tool()
def listar_proyectos_ppm(
    excel_path: Annotated[
        str,
        "Ruta relativa al Excel PPM dentro de FILES_BASE_DIR. "
        "Si se omite, usa 'ppm/plantilla_ppm.xlsx'.",
    ] = "",
) -> list[dict]:
    """
    Lee el Excel PPM y devuelve el resumen de todos los proyectos.

    Útil para ver qué proyectos hay, su avance y estado antes
    de generar la presentación.
    """
    excel = Path(settings.files_base_dir) / (excel_path or "ppm/plantilla_ppm.xlsx")

    if not excel.exists():
        raise FileNotFoundError(f"No encontré el Excel en: {excel}")

    projects = read_all_projects(str(excel))

    return [
        {
            "folio_ppm": r.folio_ppm,
            "nombre_proyecto": r.nombre_proyecto,
            "activo": r.activo,
            "lider_cliente": r.lider_cliente,
            "avance_planeado": r.avance_planeado,
            "avance_real": r.avance_real,
            "fecha_inicio": str(r.fecha_inicio) if r.fecha_inicio else None,
            "fecha_fin_liberacion": str(r.fecha_fin_liberacion) if r.fecha_fin_liberacion else None,
            "descripcion_estatus": r.descripcion_estatus,
            "actividades_gantt": len(g),
            "riesgos": len(ri),
        }
        for r, g, ri in projects
    ]


@mcp.tool()
def listar_presentaciones_ppm() -> list[dict]:
    """
    Lista todos los archivos PPTX generados por esta feature.
    Devuelve nombre, ruta, tamaño y fecha de creación.
    """
    _ensure_output()
    return [
        {
            "nombre": f.name,
            "ruta": str(Path("output") / "ppm" / f.name),
            "tamaño_kb": round(f.stat().st_size / 1024, 1),
            "creado": datetime.fromtimestamp(f.stat().st_ctime).strftime("%d/%m/%Y %H:%M"),
        }
        for f in sorted(_OUTPUT_DIR.glob("*.pptx"))
    ]
