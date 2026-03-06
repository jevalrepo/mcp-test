from starlette.requests import Request
from starlette.responses import JSONResponse
from src.tools.ppm.db.database import get_session
from src.tools.ppm.db.models import Etapa


def _serialize(e: Etapa) -> dict:
    return {
        "id": e.id,
        "folio_ppm": e.folio_ppm,
        "nombre": e.nombre,
        "estatus": e.estatus,
    }


async def list_etapas(request: Request) -> JSONResponse:
    db = get_session()
    try:
        folio = request.query_params.get("folio_ppm")
        q = db.query(Etapa)
        if folio:
            q = q.filter_by(folio_ppm=folio)
        rows = q.order_by(Etapa.folio_ppm, Etapa.id).all()
        return JSONResponse([_serialize(e) for e in rows])
    finally:
        db.close()


async def create_etapa(request: Request) -> JSONResponse:
    db = get_session()
    try:
        body = await request.json()
        obj = Etapa(
            folio_ppm=body["folio_ppm"],
            nombre=body["nombre"],
            estatus=body.get("estatus", "VERDE"),
        )
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return JSONResponse(_serialize(obj), status_code=201)
    finally:
        db.close()


async def update_etapa(request: Request) -> JSONResponse:
    db = get_session()
    try:
        id_ = int(request.path_params["id"])
        obj = db.query(Etapa).filter_by(id=id_).first()
        if not obj:
            return JSONResponse({"error": "No encontrada"}, status_code=404)
        body = await request.json()
        for field in ("nombre", "estatus"):
            if field in body:
                setattr(obj, field, body[field])
        db.commit()
        return JSONResponse(_serialize(obj))
    finally:
        db.close()


async def delete_etapa(request: Request) -> JSONResponse:
    db = get_session()
    try:
        id_ = int(request.path_params["id"])
        obj = db.query(Etapa).filter_by(id=id_).first()
        if not obj:
            return JSONResponse({"error": "No encontrada"}, status_code=404)
        db.delete(obj)
        db.commit()
        return JSONResponse({"ok": True})
    finally:
        db.close()
