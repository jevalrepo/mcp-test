"""
Feature: PPM (Project Portfolio Management)
============================================
Genera presentaciones PowerPoint de seguimiento de proyectos.
Los datos se leen/escriben desde SQLite (data/ppm/ppm.db).

Archivos de la feature:
  src/tools/ppm/
    __init__.py       ← este archivo: define los @mcp.tool()
    db/
      models.py       ← modelos SQLAlchemy
      database.py     ← sesión SQLite
      init_db.py      ← inicializa tablas
    ppt_writer.py     ← construye el PPTX

Salidas:
  output/ppm/*.pptx
  output/ppm/*.csv
  output/pdfs/*.pdf
"""

import csv
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Annotated, Any, Optional

from src.config import settings
from src.server import mcp
from src.tools.ppm.db.database import get_session
from src.tools.ppm.db.models import (
    Proyecto, Actividad, Riesgo, HistorialAvance,
)
from src.tools.ppm.ppt_writer import build_ppt_multi


# ── Dataclasses de transferencia (usados por ppt_writer) ─────────────────────

@dataclass
class Resumen:
    activo: Any = 1
    folio_ppm: str = ""
    nombre_proyecto: str = ""
    objetivo: str = ""
    horas_internas: int = 0
    horas_externas: int = 0
    horas_totales: int = 0
    costo_total: float = 0.0
    fecha_inicio: Any = None
    fecha_fin_liberacion: Any = None
    fecha_fin_garantia: Any = None
    avance_planeado: float = 0.0
    avance_real: float = 0.0
    direccion_area: str = ""
    lider_cliente: str = ""
    ern: str = ""
    le: str = ""
    ppm: str = ""
    descripcion_estatus: str = ""


@dataclass
class GanttRow:
    folio_ppm: str
    actividad: str
    responsable: str
    fecha_inicio: Any
    fecha_fin: Any
    avance: Any
    estatus_etapa: Optional[str] = None


@dataclass
class RiesgoRow:
    folio_ppm: str
    riesgo: str
    responsable: str
    mitigacion: str
    fecha_materializacion: Any

# ── Rutas ────────────────────────────────────────────────────────────────────
_OUTPUT_DIR = Path(settings.output_dir) / "ppm"
_DEFAULT_TEMPLATE = Path(settings.files_base_dir) / "ppm" / "master.pptx"


def _ensure_output():
    _OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# ── Helpers de conversión DB → dataclass (para reusar ppt_writer) ────────────

def _proyecto_to_resumen(p: Proyecto) -> Resumen:
    return Resumen(
        activo=p.activo,
        folio_ppm=p.folio_ppm or "",
        nombre_proyecto=p.nombre_proyecto or "",
        objetivo=p.objetivo or "",
        horas_internas=p.horas_internas or 0,
        horas_externas=p.horas_externas or 0,
        horas_totales=p.horas_totales or 0,
        costo_total=p.costo_total or 0.0,
        fecha_inicio=p.fecha_inicio,
        fecha_fin_liberacion=p.fecha_fin_liberacion,
        fecha_fin_garantia=p.fecha_fin_garantia,
        avance_planeado=p.avance_planeado or 0.0,
        avance_real=p.avance_real or 0.0,
        direccion_area=p.area_nombre or "",
        lider_cliente=p.lider_cliente_nombre or "",
        ern=p.ern or "",
        le=p.le or "",
        ppm=p.ppm or "",
        descripcion_estatus=p.descripcion_estatus or "",
    )


def _actividad_to_gantt(a: Actividad) -> GanttRow:
    return GanttRow(
        folio_ppm=a.folio_ppm,
        actividad=a.actividad or "",
        responsable=a.responsable_nombre or "",
        fecha_inicio=a.fecha_inicio,
        fecha_fin=a.fecha_fin,
        avance=a.avance or 0,
        estatus_etapa=a.estatus_etapa,
    )


def _riesgo_to_row(r: Riesgo) -> RiesgoRow:
    return RiesgoRow(
        folio_ppm=r.folio_ppm,
        riesgo=r.riesgo or "",
        responsable=r.responsable_nombre or "",
        mitigacion=r.mitigacion or "",
        fecha_materializacion=r.fecha_materializacion,
    )


def _db_estatus_to_ppt(s) -> str:
    """Convierte estatus de etapa de la BD al valor que espera el ppt_writer."""
    if not s:
        return ""
    s = s.strip().upper()
    if s == "COMPLETADO":
        return "COMPLETO"
    if s in ("VERDE", "AMARILLO", "ROJO"):
        return "EN_CURSO"
    return s


def _load_projects(estatuses: list | None = None):
    """
    Carga proyectos desde SQLite.
    Retorna (lista_proyectos, etapas_by_folio).
      - lista_proyectos: [(Resumen, [GanttRow], [RiesgoRow]), ...]
      - etapas_by_folio: {folio_ppm: {nombre_etapa: estatus}}
    Si estatuses es una lista, filtra por los estatus indicados (None/'' = sin estatus).
    Si estatuses es None no aplica ningún filtro.
    """
    from sqlalchemy import or_
    db = get_session()
    try:
        q = db.query(Proyecto).order_by(Proyecto.folio_ppm)
        if estatuses is not None:
            has_null = any(s is None or s == "" for s in estatuses)
            non_null = [s for s in estatuses if s]
            if has_null and non_null:
                q = q.filter(or_(Proyecto.estatus.in_(non_null), Proyecto.estatus == None, Proyecto.estatus == ""))
            elif has_null:
                q = q.filter(or_(Proyecto.estatus == None, Proyecto.estatus == ""))
            elif non_null:
                q = q.filter(Proyecto.estatus.in_(non_null))
            else:
                # Lista vacía → no incluir nada
                return [], {}
        rows = q.all()
        result = []
        etapas_by_folio = {}
        for p in rows:
            gantt = [_actividad_to_gantt(a) for a in sorted(p.actividades, key=lambda x: x.orden)]
            riesgos = [_riesgo_to_row(r) for r in p.riesgos if r.activo]
            result.append((_proyecto_to_resumen(p), gantt, riesgos))
            if p.etapas:
                etapas_by_folio[p.folio_ppm] = {
                    e.nombre: _db_estatus_to_ppt(e.estatus)
                    for e in sorted(p.etapas, key=lambda x: x.id)
                }
        return result, etapas_by_folio
    finally:
        db.close()


def _registrar_historial(db, folio: str, tipo: str, campo: str,
                          valor_anterior, valor_nuevo, referencia: str = ""):
    if str(valor_anterior) != str(valor_nuevo):
        db.add(HistorialAvance(
            folio_ppm=folio,
            tipo=tipo,
            referencia=referencia,
            campo=campo,
            valor_anterior=str(valor_anterior),
            valor_nuevo=str(valor_nuevo),
            fecha=datetime.utcnow(),
        ))


# ── Tools MCP — PPTX ─────────────────────────────────────────────────────────

@mcp.tool()
def generar_presentacion_ppm(
    nombre_archivo: Annotated[
        str, "Nombre del PPTX de salida, sin extensión (ej. 'reporte_marzo')"
    ] = "salida_proyectos",
    estatuses: Annotated[
        list | None,
        "Lista de estatus a incluir (ej. ['Ejecución', 'Por revisar']). None = todos."
    ] = None,
) -> str:
    """
    Genera una presentación PowerPoint con un slide por proyecto.
    Lee los datos desde la base de datos SQLite (data/ppm/ppm.db).
    """
    _ensure_output()

    if not _DEFAULT_TEMPLATE.exists():
        raise FileNotFoundError(f"No encontré master.pptx en: {_DEFAULT_TEMPLATE}")

    projects, etapas_by_folio = _load_projects(estatuses)
    all_projects, _ = _load_projects(None)
    omitidos = len(all_projects) - len(projects)

    out_file = _OUTPUT_DIR / f"{nombre_archivo}.pptx"
    build_ppt_multi(
        template_path=str(_DEFAULT_TEMPLATE),
        out_path=str(out_file),
        projects=projects,
        etapas_by_folio=etapas_by_folio,
        gen_prefix="gen_gantt_",
    )

    ruta = str(Path("output") / "ppm" / f"{nombre_archivo}.pptx")
    return (
        f"Presentación generada: {ruta}\n"
        f"  Proyectos incluidos : {len(projects)}\n"
        f"  Proyectos omitidos  : {omitidos}"
    )


@mcp.tool()
def listar_proyectos_ppm() -> list[dict]:
    """Lista todos los proyectos PPM desde la base de datos."""
    db = get_session()
    try:
        rows = db.query(Proyecto).order_by(Proyecto.folio_ppm).all()
        return [
            {
                "folio_ppm": p.folio_ppm,
                "nombre_proyecto": p.nombre_proyecto,
                "activo": p.activo,
                "lider_cliente": p.lider_cliente_nombre,
                "area": p.area_nombre,
                "avance_planeado": p.avance_planeado,
                "avance_real": p.avance_real,
                "fecha_inicio": p.fecha_inicio,
                "fecha_fin_liberacion": p.fecha_fin_liberacion,
                "descripcion_estatus": p.descripcion_estatus,
                "actividades": len(p.actividades),
                "riesgos": len(p.riesgos),
            }
            for p in rows
        ]
    finally:
        db.close()


@mcp.tool()
def listar_presentaciones_ppm() -> list[dict]:
    """Lista todos los archivos PPTX generados en output/ppm/."""
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


# ── Tools MCP — Edición de datos ─────────────────────────────────────────────

@mcp.tool()
def actualizar_proyecto_ppm(
    folio: Annotated[str, "Folio PPM del proyecto (ej. 'F-199669')"],
    campo: Annotated[str, "Campo a actualizar (ej. 'avance_real', 'descripcion_estatus')"],
    valor: Annotated[str, "Nuevo valor"],
) -> str:
    """Actualiza un campo del proyecto en la base de datos. Registra historial automáticamente."""
    db = get_session()
    try:
        p = db.query(Proyecto).filter_by(folio_ppm=folio).first()
        if not p:
            raise ValueError(f"Proyecto '{folio}' no encontrado")

        anterior = getattr(p, campo, None)
        if anterior is None and campo not in p.__table__.columns:
            raise ValueError(f"Campo '{campo}' no existe en proyectos")

        valor_conv: object = valor
        try:
            valor_conv = int(valor) if "." not in valor else float(valor)
        except (ValueError, TypeError):
            pass

        _registrar_historial(db, folio, "proyecto", campo, anterior, valor_conv)
        setattr(p, campo, valor_conv)
        p.actualizado_en = datetime.utcnow()
        db.commit()
        return f"Proyecto '{folio}': '{campo}' actualizado a '{valor}'"
    finally:
        db.close()


@mcp.tool()
def activar_proyecto_ppm(
    folio: Annotated[str, "Folio PPM del proyecto a activar"],
) -> str:
    """Activa un proyecto (activo = 1). Volverá a aparecer en las presentaciones."""
    db = get_session()
    try:
        p = db.query(Proyecto).filter_by(folio_ppm=folio).first()
        if not p:
            raise ValueError(f"Proyecto '{folio}' no encontrado")
        p.activo = 1
        p.actualizado_en = datetime.utcnow()
        db.commit()
        return f"Proyecto '{folio}' activado."
    finally:
        db.close()


@mcp.tool()
def desactivar_proyecto_ppm(
    folio: Annotated[str, "Folio PPM del proyecto a desactivar"],
) -> str:
    """Desactiva un proyecto (activo = 0). Quedará oculto en presentaciones."""
    db = get_session()
    try:
        p = db.query(Proyecto).filter_by(folio_ppm=folio).first()
        if not p:
            raise ValueError(f"Proyecto '{folio}' no encontrado")
        p.activo = 0
        p.actualizado_en = datetime.utcnow()
        db.commit()
        return f"Proyecto '{folio}' desactivado."
    finally:
        db.close()


@mcp.tool()
def agregar_proyecto_ppm(
    folio: Annotated[str, "Folio único (ej. 'F-200900')"],
    nombre: Annotated[str, "Nombre del proyecto"],
    objetivo: Annotated[str, "Descripción del objetivo"] = "",
    lider_cliente: Annotated[str, "Nombre del líder"] = "",
    direccion_area: Annotated[str, "Nombre del área"] = "",
    fecha_inicio: Annotated[str, "Fecha inicio YYYY-MM-DD"] = "",
    fecha_fin_liberacion: Annotated[str, "Fecha fin YYYY-MM-DD"] = "",
) -> str:
    """Agrega un proyecto nuevo a la base de datos PPM."""
    db = get_session()
    try:
        if db.query(Proyecto).filter_by(folio_ppm=folio).first():
            raise ValueError(f"El folio '{folio}' ya existe")

        p = Proyecto(
            folio_ppm=folio,
            nombre_proyecto=nombre,
            objetivo=objetivo,
            activo=1,
            lider_cliente_nombre=lider_cliente or None,
            area_nombre=direccion_area or None,
            fecha_inicio=fecha_inicio or None,
            fecha_fin_liberacion=fecha_fin_liberacion or None,
            avance_planeado=0.0,
            avance_real=0.0,
        )
        db.add(p)
        db.commit()
        return f"Proyecto '{folio} — {nombre}' agregado exitosamente."
    finally:
        db.close()


@mcp.tool()
def duplicar_proyecto_ppm(
    folio_origen: Annotated[str, "Folio del proyecto a duplicar"],
    folio_nuevo: Annotated[str, "Folio del nuevo proyecto"],
    nombre_nuevo: Annotated[str, "Nombre del nuevo proyecto"],
) -> str:
    """Duplica un proyecto con sus actividades y riesgos con un nuevo folio."""
    db = get_session()
    try:
        origen = db.query(Proyecto).filter_by(folio_ppm=folio_origen).first()
        if not origen:
            raise ValueError(f"Proyecto '{folio_origen}' no encontrado")
        if db.query(Proyecto).filter_by(folio_ppm=folio_nuevo).first():
            raise ValueError(f"El folio '{folio_nuevo}' ya existe")

        nuevo = Proyecto(
            folio_ppm=folio_nuevo,
            nombre_proyecto=nombre_nuevo,
            objetivo=origen.objetivo,
            activo=origen.activo,
            area_nombre=origen.area_nombre,
            lider_cliente_nombre=origen.lider_cliente_nombre,
            ern=origen.ern,
            le=origen.le,
            ppm=origen.ppm,
            horas_internas=origen.horas_internas,
            horas_externas=origen.horas_externas,
            horas_totales=origen.horas_totales,
            costo_total=origen.costo_total,
            fecha_inicio=origen.fecha_inicio,
            fecha_fin_liberacion=origen.fecha_fin_liberacion,
            fecha_fin_garantia=origen.fecha_fin_garantia,
            avance_planeado=0.0,
            avance_real=0.0,
            descripcion_estatus=origen.descripcion_estatus,
        )
        db.add(nuevo)
        db.flush()

        n_act = 0
        for a in origen.actividades:
            db.add(Actividad(
                folio_ppm=folio_nuevo,
                actividad=a.actividad,
                responsable_nombre=a.responsable_nombre,
                fecha_inicio=a.fecha_inicio,
                fecha_fin=a.fecha_fin,
                avance=0.0,
                estatus_etapa=a.estatus_etapa,
                orden=a.orden,
            ))
            n_act += 1

        n_ri = 0
        for r in origen.riesgos:
            db.add(Riesgo(
                folio_ppm=folio_nuevo,
                riesgo=r.riesgo,
                responsable_nombre=r.responsable_nombre,
                mitigacion=r.mitigacion,
            ))
            n_ri += 1

        db.commit()
        return (
            f"Proyecto duplicado:\n"
            f"  Origen : {folio_origen}\n"
            f"  Nuevo  : {folio_nuevo} — {nombre_nuevo}\n"
            f"  Actividades copiadas: {n_act}\n"
            f"  Riesgos copiados    : {n_ri}"
        )
    finally:
        db.close()


@mcp.tool()
def actualizar_actividad_gantt(
    folio: Annotated[str, "Folio PPM del proyecto"],
    actividad: Annotated[str, "Nombre (parcial) de la actividad"],
    campo: Annotated[str, "Campo a actualizar: avance, fecha_inicio, fecha_fin, estatus_etapa"],
    valor: Annotated[str, "Nuevo valor (avance como decimal: 0.8 = 80%)"],
) -> str:
    """Actualiza un campo de una actividad GANTT. Registra historial si es avance."""
    db = get_session()
    try:
        acts = (
            db.query(Actividad)
            .filter(Actividad.folio_ppm == folio)
            .filter(Actividad.actividad.ilike(f"%{actividad}%"))
            .all()
        )
        if not acts:
            raise ValueError(f"No se encontró actividad '{actividad}' en proyecto '{folio}'")
        if len(acts) > 1:
            nombres = [a.actividad for a in acts]
            raise ValueError(f"Coinciden varias actividades: {nombres}. Sé más específico.")

        act = acts[0]
        campos_permitidos = {"avance", "fecha_inicio", "fecha_fin", "estatus_etapa"}
        if campo not in campos_permitidos:
            raise ValueError(f"Campo '{campo}' no permitido. Usa uno de: {sorted(campos_permitidos)}")
        anterior = getattr(act, campo, None)
        valor_conv: object = valor
        try:
            valor_conv = int(valor) if "." not in valor else float(valor)
        except (ValueError, TypeError):
            pass

        if campo == "avance":
            _registrar_historial(db, folio, "actividad", "avance", anterior, valor_conv, act.actividad)

        setattr(act, campo, valor_conv)
        db.commit()
        return f"Actividad '{act.actividad}' (folio {folio}): '{campo}' → '{valor}'"
    finally:
        db.close()


# ── Tools MCP — Análisis ──────────────────────────────────────────────────────

@mcp.tool()
def proyectos_retrasados_ppm() -> list[dict]:
    """Proyectos activos donde avance real < avance planeado, ordenados por brecha."""
    db = get_session()
    try:
        rows = db.query(Proyecto).filter(Proyecto.activo == 1).all()
        retrasados = []
        for p in rows:
            plan = p.avance_planeado or 0
            real = p.avance_real or 0
            if real < plan:
                retrasados.append({
                    "folio_ppm": p.folio_ppm,
                    "nombre_proyecto": p.nombre_proyecto,
                    "lider_cliente": p.lider_cliente_nombre,
                    "avance_planeado": plan,
                    "avance_real": real,
                    "brecha": round(plan - real, 4),
                    "descripcion_estatus": p.descripcion_estatus,
                })
        retrasados.sort(key=lambda x: x["brecha"], reverse=True)
        return retrasados
    finally:
        db.close()


@mcp.tool()
def proyectos_por_lider_ppm() -> list[dict]:
    """Agrupa proyectos activos por líder de cliente."""
    db = get_session()
    try:
        rows = db.query(Proyecto).filter(Proyecto.activo == 1).all()
        lideres: dict[str, list] = {}
        for p in rows:
            lider = p.lider_cliente_nombre or "Sin asignar"
            lideres.setdefault(lider, []).append(p)

        return [
            {
                "lider_cliente": lider,
                "total_proyectos": len(ps),
                "promedio_avance_real": round(sum(p.avance_real or 0 for p in ps) / len(ps), 2),
                "proyectos_retrasados": sum(
                    1 for p in ps if (p.avance_real or 0) < (p.avance_planeado or 0)
                ),
                "proyectos": [
                    {"folio": p.folio_ppm, "nombre": p.nombre_proyecto,
                     "avance_real": p.avance_real, "avance_planeado": p.avance_planeado}
                    for p in ps
                ],
            }
            for lider, ps in sorted(lideres.items())
        ]
    finally:
        db.close()


@mcp.tool()
def estadisticas_ppm() -> dict:
    """Estadísticas generales del portafolio PPM."""
    db = get_session()
    try:
        todos = db.query(Proyecto).all()
        activos = [p for p in todos if p.activo]
        retrasados = [p for p in activos if (p.avance_real or 0) < (p.avance_planeado or 0)]

        lideres: dict[str, int] = {}
        for p in activos:
            lider = p.lider_cliente_nombre or "Sin asignar"
            lideres[lider] = lideres.get(lider, 0) + 1

        total_acts = sum(len(p.actividades) for p in activos)
        total_ri = sum(len(p.riesgos) for p in activos)

        return {
            "resumen_general": {
                "total_proyectos": len(todos),
                "activos": len(activos),
                "inactivos": len(todos) - len(activos),
            },
            "avance": {
                "promedio_planeado_pct": round(
                    sum(p.avance_planeado or 0 for p in activos) / len(activos) * 100, 1
                ) if activos else 0,
                "promedio_real_pct": round(
                    sum(p.avance_real or 0 for p in activos) / len(activos) * 100, 1
                ) if activos else 0,
                "proyectos_retrasados": len(retrasados),
                "proyectos_al_dia": len(activos) - len(retrasados),
            },
            "actividades_y_riesgos": {
                "total_actividades": total_acts,
                "total_riesgos": total_ri,
            },
            "top_lideres": [
                {"lider": l, "proyectos": n}
                for l, n in sorted(lideres.items(), key=lambda x: x[1], reverse=True)[:3]
            ],
        }
    finally:
        db.close()


# ── Tools MCP — Reportes ──────────────────────────────────────────────────────

@mcp.tool()
def exportar_proyectos_csv(
    nombre_archivo: Annotated[str, "Nombre del CSV (sin extensión)"] = "proyectos_ppm",
    solo_activos: Annotated[bool, "Si True exporta solo activos"] = False,
) -> str:
    """Exporta los proyectos a CSV en output/ppm/."""
    db = get_session()
    try:
        q = db.query(Proyecto).order_by(Proyecto.folio_ppm)
        if solo_activos:
            q = q.filter(Proyecto.activo == 1)
        rows = q.all()

        _ensure_output()
        out = _OUTPUT_DIR / f"{nombre_archivo}.csv"
        campos = [
            "folio_ppm", "nombre_proyecto", "activo", "area", "lider_cliente",
            "avance_planeado", "avance_real", "fecha_inicio", "fecha_fin_liberacion",
            "horas_totales", "costo_total", "descripcion_estatus",
        ]
        with open(str(out), "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=campos)
            writer.writeheader()
            for p in rows:
                writer.writerow({
                    "folio_ppm": p.folio_ppm,
                    "nombre_proyecto": p.nombre_proyecto,
                    "activo": p.activo,
                    "area": p.area_nombre or "",
                    "lider_cliente": p.lider_cliente_nombre or "",
                    "avance_planeado": p.avance_planeado,
                    "avance_real": p.avance_real,
                    "fecha_inicio": p.fecha_inicio or "",
                    "fecha_fin_liberacion": p.fecha_fin_liberacion or "",
                    "horas_totales": p.horas_totales,
                    "costo_total": p.costo_total,
                    "descripcion_estatus": p.descripcion_estatus or "",
                })

        ruta = str(Path("output") / "ppm" / f"{nombre_archivo}.csv")
        return f"CSV exportado: {ruta} ({len(rows)} proyectos)"
    finally:
        db.close()


@mcp.tool()
def generar_reporte_pdf_ppm(
    nombre_archivo: Annotated[str, "Nombre del PDF (sin extensión)"] = "reporte_ppm",
    solo_activos: Annotated[bool, "Si True incluye solo activos"] = True,
) -> str:
    """Genera un reporte PDF ejecutivo con tabla de proyectos PPM."""
    from reportlab.lib import colors as rl_colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import cm
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable,
    )

    db = get_session()
    try:
        q = db.query(Proyecto).order_by(Proyecto.folio_ppm)
        if solo_activos:
            q = q.filter(Proyecto.activo == 1)
        rows = q.all()

        pdf_dir = Path(settings.output_dir) / "pdfs"
        pdf_dir.mkdir(parents=True, exist_ok=True)
        out_file = pdf_dir / f"{nombre_archivo}.pdf"

        COLOR_ROJO = rl_colors.HexColor("#C8102E")
        COLOR_AZUL = rl_colors.HexColor("#1A1A2E")
        COLOR_FONDO = rl_colors.HexColor("#F5F5F5")
        COLOR_BORDE = rl_colors.HexColor("#CCCCCC")

        doc = SimpleDocTemplate(
            str(out_file),
            pagesize=(A4[1], A4[0]),
            rightMargin=1.5 * cm, leftMargin=1.5 * cm,
            topMargin=2 * cm, bottomMargin=2 * cm,
        )
        styles = getSampleStyleSheet()
        titulo_style = ParagraphStyle(
            "T", parent=styles["Title"], fontSize=16, textColor=COLOR_AZUL,
        )
        story = [
            Paragraph("Reporte Ejecutivo — Portafolio de Proyectos PPM", titulo_style),
            HRFlowable(width="100%", thickness=2, color=COLOR_ROJO, spaceAfter=4),
            Paragraph(
                f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}  |  "
                f"{len(rows)} proyectos",
                styles["Normal"],
            ),
            Spacer(1, 0.5 * cm),
        ]

        col_widths = [2.5 * cm, 7.5 * cm, 4.5 * cm, 2.5 * cm, 2.5 * cm, 5.5 * cm]
        table_data = [["Folio", "Proyecto", "Líder", "Planeado", "Real", "Estatus"]]
        for p in rows:
            plan = (p.avance_planeado or 0) * 100 if (p.avance_planeado or 0) <= 1 else (p.avance_planeado or 0)
            real = (p.avance_real or 0) * 100 if (p.avance_real or 0) <= 1 else (p.avance_real or 0)
            table_data.append([
                p.folio_ppm or "",
                (p.nombre_proyecto or "")[:45],
                (p.lider_cliente_nombre or "")[:22],
                f"{plan:.0f}%",
                f"{real:.0f}%",
                (p.descripcion_estatus or "")[:35],
            ])

        table = Table(table_data, colWidths=col_widths, repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), COLOR_ROJO),
            ("TEXTCOLOR", (0, 0), (-1, 0), rl_colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, 0), 9),
            ("ALIGN", (3, 1), (4, -1), "CENTER"),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE", (0, 1), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [rl_colors.white, COLOR_FONDO]),
            ("GRID", (0, 0), (-1, -1), 0.5, COLOR_BORDE),
            ("BOX", (0, 0), (-1, -1), 1, COLOR_ROJO),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(table)
        doc.build(story)

        ruta = str(Path("output") / "pdfs" / f"{nombre_archivo}.pdf")
        return f"Reporte PDF generado: {ruta} ({len(rows)} proyectos)"
    finally:
        db.close()


