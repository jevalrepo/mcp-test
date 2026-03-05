from datetime import datetime
from starlette.requests import Request
from starlette.responses import JSONResponse
from src.tools.ppm.db.database import get_session
from src.tools.ppm.db.models import Actividad, HistorialAvance, Proyecto


ACTIVIDADES_DEFAULT = [
    "Análisis Técnico",
    "Diseño Detallado",
    "Realización",
    "Pruebas modulares",
    "Pruebas de certificación",
    "Implementación",
    "Garantía",
]


def _ensure_default_actividades(db, folio: str) -> None:
    proyecto_exists = db.query(Proyecto).filter_by(folio_ppm=folio).first()
    if not proyecto_exists:
        return

    existing = {
        str(a.actividad).strip()
        for a in db.query(Actividad).filter_by(folio_ppm=folio).all()
        if a.actividad is not None
    }
    for orden, actividad in enumerate(ACTIVIDADES_DEFAULT):
        if actividad not in existing:
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


def _serialize(a: Actividad) -> dict:
    return {
        "id": a.id,
        "folio_ppm": a.folio_ppm,
        "actividad": a.actividad,
        "responsable_nombre": a.responsable_nombre,
        "fecha_inicio": a.fecha_inicio,
        "fecha_fin": a.fecha_fin,
        "avance": a.avance,
        "estatus_etapa": a.estatus_etapa,
        "orden": a.orden,
    }


async def list_actividades(request: Request) -> JSONResponse:
    db = get_session()
    try:
        folio = request.query_params.get("folio_ppm")
        if folio:
            _ensure_default_actividades(db, folio)
            db.commit()
        q = db.query(Actividad)
        if folio:
            q = q.filter_by(folio_ppm=folio)
        rows = q.order_by(Actividad.folio_ppm, Actividad.orden).all()
        return JSONResponse([_serialize(a) for a in rows])
    finally:
        db.close()


async def create_actividad(request: Request) -> JSONResponse:
    db = get_session()
    try:
        body = await request.json()
        obj = Actividad(
            folio_ppm=body["folio_ppm"],
            actividad=body["actividad"],
            responsable_nombre=body.get("responsable_nombre"),
            fecha_inicio=body.get("fecha_inicio"),
            fecha_fin=body.get("fecha_fin"),
            avance=float(body.get("avance", 0)),
            estatus_etapa=body.get("estatus_etapa"),
            orden=body.get("orden", 0),
        )
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return JSONResponse(_serialize(obj), status_code=201)
    finally:
        db.close()


async def update_actividad(request: Request) -> JSONResponse:
    db = get_session()
    try:
        id_ = int(request.path_params["id"])
        obj = db.query(Actividad).filter_by(id=id_).first()
        if not obj:
            return JSONResponse({"error": "No encontrada"}, status_code=404)
        body = await request.json()

        for field in ("actividad", "responsable_nombre", "fecha_inicio", "fecha_fin", "estatus_etapa", "orden"):
            if field in body:
                setattr(obj, field, body[field])

        if "avance" in body:
            nuevo = float(body["avance"])
            if nuevo != obj.avance:
                db.add(HistorialAvance(
                    folio_ppm=obj.folio_ppm,
                    tipo="actividad",
                    referencia=obj.actividad,
                    campo="avance",
                    valor_anterior=str(obj.avance),
                    valor_nuevo=str(nuevo),
                    fecha=datetime.utcnow(),
                ))
            obj.avance = nuevo

        db.commit()
        db.refresh(obj)
        return JSONResponse(_serialize(obj))
    finally:
        db.close()


async def delete_actividad(request: Request) -> JSONResponse:
    db = get_session()
    try:
        id_ = int(request.path_params["id"])
        obj = db.query(Actividad).filter_by(id=id_).first()
        if not obj:
            return JSONResponse({"error": "No encontrada"}, status_code=404)
        db.delete(obj)
        db.commit()
        return JSONResponse({"ok": True})
    finally:
        db.close()
