from starlette.requests import Request
from starlette.responses import JSONResponse
from src.tools.ppm.db.database import get_session
from src.tools.ppm.db.models import Riesgo


def _serialize(r: Riesgo) -> dict:
    return {
        "id": r.id,
        "folio_ppm": r.folio_ppm,
        "riesgo": r.riesgo,
        "responsable_nombre": r.responsable_nombre,
        "mitigacion": r.mitigacion,
        "fecha_materializacion": r.fecha_materializacion,
        "activo": r.activo,
    }


async def list_riesgos(request: Request) -> JSONResponse:
    db = get_session()
    try:
        folio = request.query_params.get("folio_ppm")
        q = db.query(Riesgo)
        if folio:
            q = q.filter_by(folio_ppm=folio)
        return JSONResponse([_serialize(r) for r in q.all()])
    finally:
        db.close()


async def create_riesgo(request: Request) -> JSONResponse:
    db = get_session()
    try:
        body = await request.json()
        obj = Riesgo(
            folio_ppm=body["folio_ppm"],
            riesgo=body["riesgo"],
            responsable_nombre=body.get("responsable_nombre"),
            mitigacion=body.get("mitigacion"),
            fecha_materializacion=body.get("fecha_materializacion"),
        )
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return JSONResponse(_serialize(obj), status_code=201)
    finally:
        db.close()


async def update_riesgo(request: Request) -> JSONResponse:
    db = get_session()
    try:
        id_ = int(request.path_params["id"])
        obj = db.query(Riesgo).filter_by(id=id_).first()
        if not obj:
            return JSONResponse({"error": "No encontrado"}, status_code=404)
        body = await request.json()
        for field in ("riesgo", "responsable_nombre", "mitigacion", "fecha_materializacion", "activo"):
            if field in body:
                setattr(obj, field, body[field])
        db.commit()
        return JSONResponse(_serialize(obj))
    finally:
        db.close()


async def delete_riesgo(request: Request) -> JSONResponse:
    db = get_session()
    try:
        id_ = int(request.path_params["id"])
        obj = db.query(Riesgo).filter_by(id=id_).first()
        if not obj:
            return JSONResponse({"error": "No encontrado"}, status_code=404)
        db.delete(obj)
        db.commit()
        return JSONResponse({"ok": True})
    finally:
        db.close()
