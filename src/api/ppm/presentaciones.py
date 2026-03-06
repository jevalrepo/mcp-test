from datetime import datetime
from pathlib import Path

from starlette.requests import Request
from starlette.responses import JSONResponse

from src.config import settings
from src.tools.ppm import _load_projects
from src.tools.ppm.ppt_writer import build_ppt_multi

_OUTPUT_DIR = Path(settings.output_dir) / "ppm"
_TEMPLATE = Path(settings.files_base_dir) / "ppm" / "master.pptx"


async def list_presentaciones(request: Request) -> JSONResponse:
    """GET /api/ppm/presentaciones — lista todos los PPTX en output/ppm/."""
    _OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    files = []
    for f in sorted(_OUTPUT_DIR.glob("*.pptx"), key=lambda x: x.stat().st_mtime, reverse=True):
        files.append({
            "nombre": f.name,
            "ruta": f"ppm/{f.name}",
            "url_descarga": f"/descargar/ppm/{f.name}",
            "tamaño_kb": round(f.stat().st_size / 1024, 1),
            "creado": datetime.fromtimestamp(f.stat().st_mtime).strftime("%d/%m/%Y %H:%M"),
        })
    return JSONResponse(files)


async def generar_presentacion(request: Request) -> JSONResponse:
    """POST /api/ppm/presentaciones — genera un PPTX desde SQLite."""
    body = await request.json()
    nombre_archivo = (body.get("nombre_archivo") or "salida_proyectos").strip() or "salida_proyectos"
    estatuses = body.get("estatuses")  # list[str] | None

    if not _TEMPLATE.exists():
        return JSONResponse({"error": f"Plantilla no encontrada: {_TEMPLATE}"}, status_code=500)

    _OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    projects, etapas_by_folio = _load_projects(estatuses)
    out_file = _OUTPUT_DIR / f"{nombre_archivo}.pptx"

    build_ppt_multi(
        template_path=str(_TEMPLATE),
        out_path=str(out_file),
        projects=projects,
        etapas_by_folio=etapas_by_folio,
        gen_prefix="gen_gantt_",
    )

    ruta = f"ppm/{nombre_archivo}.pptx"
    return JSONResponse({
        "nombre": f"{nombre_archivo}.pptx",
        "ruta": ruta,
        "url_descarga": f"/descargar/{ruta}",
        "proyectos": len(projects),
    })


async def eliminar_presentacion(request: Request) -> JSONResponse:
    """DELETE /api/ppm/presentaciones/{nombre} — elimina un PPTX del directorio de salida."""
    nombre = request.path_params["nombre"]

    # Seguridad: solo .pptx y sin path traversal
    if not nombre.endswith(".pptx") or "/" in nombre or "\\" in nombre:
        return JSONResponse({"error": "Nombre de archivo no válido"}, status_code=400)

    file_path = _OUTPUT_DIR / nombre
    if not file_path.exists():
        return JSONResponse({"error": "Archivo no encontrado"}, status_code=404)

    file_path.unlink()
    return JSONResponse({"ok": True})
