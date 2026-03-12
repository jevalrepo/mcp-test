"""
Sesion SQLAlchemy sincrona para la BD PPM (SQLite).
"""
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session

from src.config import settings


_ENGINE = None


def get_db_path() -> str:
    path = Path(settings.files_base_dir) / "ppm" / "ppm.db"
    path.parent.mkdir(parents=True, exist_ok=True)
    return str(path)


def _migrate_rename_ppm_to_pgm(engine) -> None:
    """Renombra proyectos.ppm → proyectos.pgm y sincroniza pgm = le."""
    with engine.begin() as conn:
        table_exists = conn.execute(
            text("SELECT 1 FROM sqlite_master WHERE type='table' AND name='proyectos' LIMIT 1")
        ).scalar()
        if not table_exists:
            return

        columns = conn.execute(text("PRAGMA table_info(proyectos)")).fetchall()
        col_names = [str(col[1]).lower() for col in columns]

        if "ppm" in col_names:
            conn.execute(text("ALTER TABLE proyectos RENAME COLUMN ppm TO pgm"))

        # Sincronizar pgm = le para todos los registros existentes
        if "pgm" in col_names or "ppm" in col_names:
            conn.execute(text("UPDATE proyectos SET pgm = le WHERE pgm IS NULL OR pgm != le"))


def _migrate_drop_actividades_color(engine) -> None:
    """Elimina actividades.color si existe, preservando registros."""
    with engine.begin() as conn:
        table_exists = conn.execute(
            text("SELECT 1 FROM sqlite_master WHERE type='table' AND name='actividades' LIMIT 1")
        ).scalar()
        if not table_exists:
            return

        columns = conn.execute(text("PRAGMA table_info(actividades)")).fetchall()
        has_color = any(str(col[1]).lower() == "color" for col in columns)
        if not has_color:
            return

        conn.execute(text("""
            CREATE TABLE actividades_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                folio_ppm VARCHAR(50) NOT NULL,
                actividad VARCHAR(500) NOT NULL,
                responsable_nombre VARCHAR(200),
                fecha_inicio VARCHAR(20),
                fecha_fin VARCHAR(20),
                avance FLOAT,
                estatus_etapa VARCHAR(100),
                orden INTEGER,
                FOREIGN KEY(folio_ppm) REFERENCES proyectos (folio_ppm)
            )
        """))
        conn.execute(text("""
            INSERT INTO actividades_new (id, folio_ppm, actividad, responsable_nombre, fecha_inicio, fecha_fin, avance, estatus_etapa, orden)
            SELECT id, folio_ppm, actividad, responsable_nombre, fecha_inicio, fecha_fin, avance, estatus_etapa, orden
            FROM actividades
        """))
        conn.execute(text("DROP TABLE actividades"))
        conn.execute(text("ALTER TABLE actividades_new RENAME TO actividades"))


def get_engine():
    global _ENGINE
    if _ENGINE is None:
        db_url = f"sqlite:///{get_db_path()}"
        _ENGINE = create_engine(db_url, connect_args={"check_same_thread": False})
        _migrate_rename_ppm_to_pgm(_ENGINE)
        _migrate_drop_actividades_color(_ENGINE)
    return _ENGINE


def get_session() -> Session:
    engine = get_engine()
    SessionLocal = sessionmaker(bind=engine)
    return SessionLocal()