"""
Inicializa la BD PPM (crea tablas si no existen).

Uso:
    python -m src.tools.ppm.db.init_db
"""
from src.tools.ppm.db.database import get_engine
from src.tools.ppm.db.models import Base


def init_db():
    engine = get_engine()
    Base.metadata.create_all(engine)
    print("Tablas PPM creadas / verificadas.")


if __name__ == "__main__":
    init_db()
