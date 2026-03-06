from datetime import datetime
from starlette.requests import Request
from starlette.responses import JSONResponse
from src.tools.ppm.db.database import get_session
from src.tools.ppm.db.models import Proyecto, HistorialAvance, Etapa, Actividad


ETAPAS_DEFAULT = [
    "Estimación",
    "Planeación",
    "Análisis_tecnico",
    "Diseño_detallado",
    "Realización",
    "QA",
    "Implementación",
    "Garantía",
]

ACTIVIDADES_DEFAULT = [
    "Análisis Técnico",
    "Diseño Detallado",
    "Realización",
    "Pruebas modulares",
    "Pruebas de certificación",
    "Implementación",
    "Garantía",
]


def _to_percent(value) -> float:
    try:
        n = float(value or 0)
    except (TypeError, ValueError):
        return 0.0
    return n * 100 if 0 <= n <= 1 else n


def _ensure_default_rows(db, folio: str) -> None:
    """Garantiza registros base de etapas y actividades para un folio."""
    existing_etapas = {
        str(e.nombre).strip()
        for e in db.query(Etapa).filter_by(folio_ppm=folio).all()
        if e.nombre is not None
    }
    for nombre in ETAPAS_DEFAULT:
        if nombre not in existing_etapas:
            db.add(Etapa(
                folio_ppm=folio,
                nombre=nombre,
                estatus=None,
            ))

    existing_acts = {
        str(a.actividad).strip()
        for a in db.query(Actividad).filter_by(folio_ppm=folio).all()
        if a.actividad is not None
    }
    for orden, actividad in enumerate(ACTIVIDADES_DEFAULT):
        if actividad not in existing_acts:
            db.add(Actividad(
                folio_ppm=folio,
                actividad=actividad,
                responsable_nombre=None,
                fecha_inicio=None,
                fecha_fin=None,
                avance=None,
                estatus_etapa=None,
                orden=orden,
            ))


def _serialize(p: Proyecto) -> dict:
    return {
        "folio_ppm": p.folio_ppm,
        "nombre_proyecto": p.nombre_proyecto,
        "objetivo": p.objetivo,
        "activo": p.activo,
        "area_nombre": p.area_nombre,
        "lider_cliente_nombre": p.lider_cliente_nombre,
        "ern": p.ern,
        "le": p.le,
        "ppm": p.ppm,
        "horas_internas": p.horas_internas,
        "horas_externas": p.horas_externas,
        "horas_totales": p.horas_totales,
        "costo_total": p.costo_total,
        "fecha_inicio": p.fecha_inicio,
        "fecha_fin_liberacion": p.fecha_fin_liberacion,
        "fecha_fin_garantia": p.fecha_fin_garantia,
        "avance_planeado": p.avance_planeado,
        "avance_real": p.avance_real,
        "estatus": p.estatus,
        "descripcion_estatus": p.descripcion_estatus,
        "creado_en": p.creado_en.isoformat() if p.creado_en else None,
        "actualizado_en": p.actualizado_en.isoformat() if p.actualizado_en else None,
    }


async def list_proyectos(request: Request) -> JSONResponse:
    from datetime import date as _date
    from collections import defaultdict
    db = get_session()
    try:
        q = db.query(Proyecto)
        if "activo" in request.query_params:
            q = q.filter_by(activo=int(request.query_params["activo"]))
        rows = q.order_by(Proyecto.folio_ppm).all()

        folios = [p.folio_ppm for p in rows]
        acts_all = db.query(Actividad).filter(Actividad.folio_ppm.in_(folios)).all() if folios else []
        acts_by_folio: dict = defaultdict(list)
        for a in acts_all:
            acts_by_folio[a.folio_ppm].append(a)

        today = str(_date.today())
        result = []
        for p in rows:
            acts = acts_by_folio.get(p.folio_ppm, [])
            valid = [a for a in acts if a.avance is not None]
            avance_total = round(sum(float(a.avance) for a in valid) / len(valid)) if valid else 0

            avance_actividad = None
            for a in sorted(acts, key=lambda x: x.orden if x.orden is not None else 999):
                if a.fecha_inicio and a.fecha_fin and a.fecha_inicio <= today <= a.fecha_fin:
                    avance_actividad = round(float(a.avance)) if a.avance is not None else 0
                    break

            # Fallback: si no hay actividad en rango hoy, mostrar la última (mayor orden)
            # cuya fecha_fin ya haya pasado.
            if avance_actividad is None:
                acts_with_end = sorted(
                    [a for a in acts if a.fecha_fin],
                    key=lambda x: x.orden if x.orden is not None else 999,
                )
                if acts_with_end and acts_with_end[-1].fecha_fin < today:
                    last = acts_with_end[-1]
                    avance_actividad = round(float(last.avance)) if last.avance is not None else 0

            data = _serialize(p)
            data["avance_total"] = avance_total
            data["avance_actividad"] = avance_actividad
            result.append(data)

        return JSONResponse(result)
    finally:
        db.close()


async def get_proyecto(request: Request) -> JSONResponse:
    db = get_session()
    try:
        folio = request.path_params["folio"]
        p = db.query(Proyecto).filter_by(folio_ppm=folio).first()
        if not p:
            return JSONResponse({"error": "Proyecto no encontrado"}, status_code=404)
        _ensure_default_rows(db, folio)
        db.commit()
        db.refresh(p)
        return JSONResponse(_serialize(p))
    finally:
        db.close()


async def create_proyecto(request: Request) -> JSONResponse:
    db = get_session()
    try:
        body = await request.json()
        folio = body.get("folio_ppm", "").strip()
        nombre = body.get("nombre_proyecto", "").strip()
        if not folio:
            return JSONResponse({"error": "folio_ppm es requerido"}, status_code=400)
        if not nombre:
            return JSONResponse({"error": "nombre_proyecto es requerido"}, status_code=400)
        if db.query(Proyecto).filter_by(folio_ppm=folio).first():
            return JSONResponse({"error": f"El folio '{folio}' ya existe"}, status_code=400)
        obj = Proyecto(
            folio_ppm=folio,
            nombre_proyecto=nombre,
            objetivo=body.get("objetivo"),
            activo=body.get("activo", 1),
            area_nombre=body.get("area_nombre"),
            lider_cliente_nombre=body.get("lider_cliente_nombre"),
            ern=body.get("ern"),
            le=body.get("le"),
            ppm=body.get("ppm"),
            horas_internas=body.get("horas_internas", 0),
            horas_externas=body.get("horas_externas", 0),
            horas_totales=body.get("horas_totales", 0),
            costo_total=body.get("costo_total", 0.0),
            fecha_inicio=body.get("fecha_inicio"),
            fecha_fin_liberacion=body.get("fecha_fin_liberacion"),
            fecha_fin_garantia=body.get("fecha_fin_garantia"),
            avance_planeado=float(body.get("avance_planeado", 0)),
            avance_real=float(body.get("avance_real", 0)),
            estatus=body.get("estatus"),
            descripcion_estatus=body.get("descripcion_estatus"),
        )
        db.add(obj)
        db.flush()
        _ensure_default_rows(db, folio)

        db.commit()
        db.refresh(obj)
        return JSONResponse(_serialize(obj), status_code=201)
    finally:
        db.close()


async def update_proyecto(request: Request) -> JSONResponse:
    db = get_session()
    try:
        folio = request.path_params["folio"]
        obj = db.query(Proyecto).filter_by(folio_ppm=folio).first()
        if not obj:
            return JSONResponse({"error": "Proyecto no encontrado"}, status_code=404)
        body = await request.json()

        for campo_avance in ("avance_planeado", "avance_real"):
            if campo_avance in body:
                nuevo = float(body[campo_avance])
                anterior = getattr(obj, campo_avance)
                if nuevo != anterior:
                    db.add(HistorialAvance(
                        folio_ppm=folio,
                        tipo="proyecto",
                        campo=campo_avance,
                        valor_anterior=str(anterior),
                        valor_nuevo=str(nuevo),
                        fecha=datetime.utcnow(),
                    ))
                setattr(obj, campo_avance, nuevo)

        for field in ("nombre_proyecto", "objetivo", "activo", "area_nombre",
                      "lider_cliente_nombre", "ern", "le", "ppm", "horas_internas",
                      "horas_externas", "horas_totales", "costo_total",
                      "fecha_inicio", "fecha_fin_liberacion", "fecha_fin_garantia",
                      "estatus", "descripcion_estatus"):
            if field in body:
                setattr(obj, field, body[field])

        obj.actualizado_en = datetime.utcnow()
        db.commit()
        db.refresh(obj)
        return JSONResponse(_serialize(obj))
    finally:
        db.close()


async def delete_proyecto(request: Request) -> JSONResponse:
    db = get_session()
    try:
        folio = request.path_params["folio"]
        obj = db.query(Proyecto).filter_by(folio_ppm=folio).first()
        if not obj:
            return JSONResponse({"error": "Proyecto no encontrado"}, status_code=404)
        db.delete(obj)
        db.commit()
        return JSONResponse({"ok": True})
    finally:
        db.close()


async def get_historial(request: Request) -> JSONResponse:
    db = get_session()
    try:
        folio = request.path_params["folio"]
        rows = (
            db.query(HistorialAvance)
            .filter_by(folio_ppm=folio)
            .order_by(HistorialAvance.fecha.desc())
            .all()
        )
        return JSONResponse([
            {
                "id": h.id,
                "tipo": h.tipo,
                "referencia": h.referencia,
                "campo": h.campo,
                "valor_anterior": h.valor_anterior,
                "valor_nuevo": h.valor_nuevo,
                "fecha": h.fecha.isoformat() if h.fecha else None,
            }
            for h in rows
        ])
    finally:
        db.close()


async def get_estadisticas(request: Request) -> JSONResponse:
    db = get_session()
    try:
        todos = db.query(Proyecto).all()
        activos = [p for p in todos if p.activo]
        retrasados = [
            p for p in activos
            if _to_percent(p.avance_real) < _to_percent(p.avance_planeado)
        ]
        promedio_real = (
            round(sum(_to_percent(p.avance_real) for p in activos) / len(activos), 1)
            if activos else 0
        )
        promedio_planeado = (
            round(sum(_to_percent(p.avance_planeado) for p in activos) / len(activos), 1)
            if activos else 0
        )
        return JSONResponse({
            "total": len(todos),
            "activos": len(activos),
            "inactivos": len(todos) - len(activos),
            "retrasados": len(retrasados),
            "al_dia": len(activos) - len(retrasados),
            "promedio_avance_real": promedio_real,
            "promedio_avance_planeado": promedio_planeado,
        })
    finally:
        db.close()
