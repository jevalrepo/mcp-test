"""
Script de prueba rápida del feature PPM.
Ejecutar desde la raíz del proyecto:

    python test_ppm.py

No requiere levantar el servidor MCP.
Verifica que las dependencias, el Excel y la generación del PPTX funcionan.
"""

import sys
from pathlib import Path

# Asegura que Python encuentre el paquete 'src'
ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

# ── 1. Leer el Excel ─────────────────────────────────────────────────────────
print("=" * 50)
print("PASO 1: Leyendo el Excel PPM...")
print("=" * 50)

from src.tools.ppm.excel_reader import read_all_projects

EXCEL = ROOT / "data" / "ppm" / "plantilla_ppm.xlsx"
TEMPLATE = ROOT / "data" / "ppm" / "master.pptx"
OUTPUT = ROOT / "output" / "ppm"

if not EXCEL.exists():
    print(f"  ERROR: No se encontró {EXCEL}")
    sys.exit(1)

projects = read_all_projects(str(EXCEL))
print(f"  Proyectos encontrados: {len(projects)}")

for resumen, gantt_rows, riesgo_rows in projects:
    activo = getattr(resumen, "activo", 1)
    print(f"  {'[✓]' if activo else '[–]'} {resumen.folio_ppm or '(sin folio)'} "
          f"| {resumen.nombre_proyecto or '(sin nombre)'} "
          f"| gantt: {len(gantt_rows)} actividades "
          f"| riesgos: {len(riesgo_rows)}")

# ── 2. Generar el PPTX ───────────────────────────────────────────────────────
print()
print("=" * 50)
print("PASO 2: Generando la presentación PPTX...")
print("=" * 50)

if not TEMPLATE.exists():
    print(f"  ERROR: No se encontró {TEMPLATE}")
    sys.exit(1)

from src.tools.ppm.ppt_writer import build_ppt_multi

OUTPUT.mkdir(parents=True, exist_ok=True)
out_file = OUTPUT / "test_salida.pptx"

build_ppt_multi(
    template_path=str(TEMPLATE),
    out_path=str(out_file),
    projects=projects,
    etapas_excel_path=str(EXCEL),
    gen_prefix="gen_gantt_",
)

size_kb = round(out_file.stat().st_size / 1024, 1)
print(f"  PPTX generado: {out_file}")
print(f"  Tamaño: {size_kb} KB")
print()
print("  Prueba completada exitosamente.")
