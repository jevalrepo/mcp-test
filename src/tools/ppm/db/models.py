"""
Modelos SQLAlchemy (síncrono) para la base de datos PPM.
Archivo: data/ppm/ppm.db
"""
from datetime import datetime

from sqlalchemy import (
    Column, Integer, String, Float, Text,
    ForeignKey, DateTime,
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class Proyecto(Base):
    __tablename__ = "proyectos"

    folio_ppm = Column(String(50), primary_key=True)
    nombre_proyecto = Column(String(500), nullable=False)
    objetivo = Column(Text)
    activo = Column(Integer, default=1)

    area_nombre = Column(String(200))
    lider_cliente_nombre = Column(String(200))

    ern = Column(String(100))
    le = Column(String(100))
    ppm = Column(String(100))

    horas_internas = Column(Integer, default=0)
    horas_externas = Column(Integer, default=0)
    horas_totales = Column(Integer, default=0)
    costo_total = Column(Float, default=0.0)

    fecha_inicio = Column(String(20))
    fecha_fin_liberacion = Column(String(20))
    fecha_fin_garantia = Column(String(20))

    avance_planeado = Column(Float, default=0.0)
    avance_real = Column(Float, default=0.0)
    estatus = Column(String(100))
    descripcion_estatus = Column(Text)

    creado_en = Column(DateTime, default=datetime.utcnow)
    actualizado_en = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    actividades = relationship("Actividad", back_populates="proyecto", cascade="all, delete-orphan")
    riesgos = relationship("Riesgo", back_populates="proyecto", cascade="all, delete-orphan")
    etapas = relationship("Etapa", back_populates="proyecto", cascade="all, delete-orphan")
    historial = relationship("HistorialAvance", back_populates="proyecto", cascade="all, delete-orphan")
    comentarios = relationship("Comentario", back_populates="proyecto", cascade="all, delete-orphan")


class Actividad(Base):
    __tablename__ = "actividades"

    id = Column(Integer, primary_key=True, autoincrement=True)
    folio_ppm = Column(String(50), ForeignKey("proyectos.folio_ppm"), nullable=False)
    actividad = Column(String(500), nullable=False)
    responsable_nombre = Column(String(200))
    fecha_inicio = Column(String(20))
    fecha_fin = Column(String(20))
    avance = Column(Float, default=0.0)
    estatus_etapa = Column(String(100))
    orden = Column(Integer, default=0)

    proyecto = relationship("Proyecto", back_populates="actividades")


class Riesgo(Base):
    __tablename__ = "riesgos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    folio_ppm = Column(String(50), ForeignKey("proyectos.folio_ppm"), nullable=False)
    riesgo = Column(Text, nullable=False)
    responsable_nombre = Column(String(200))
    mitigacion = Column(Text)
    fecha_materializacion = Column(String(20))
    activo = Column(Integer, default=1)

    proyecto = relationship("Proyecto", back_populates="riesgos")


class Etapa(Base):
    __tablename__ = "etapas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    folio_ppm = Column(String(50), ForeignKey("proyectos.folio_ppm"), nullable=False)
    nombre = Column(String(200), nullable=False)
    estatus = Column(String(20), default="VERDE")  # VERDE | AMARILLO | ROJO | COMPLETADO

    proyecto = relationship("Proyecto", back_populates="etapas")


class HistorialAvance(Base):
    __tablename__ = "historial_avance"

    id = Column(Integer, primary_key=True, autoincrement=True)
    folio_ppm = Column(String(50), ForeignKey("proyectos.folio_ppm"), nullable=False)
    tipo = Column(String(20), nullable=False)       # 'proyecto' | 'actividad'
    referencia = Column(String(500))                # nombre actividad si tipo='actividad'
    campo = Column(String(100), nullable=False)
    valor_anterior = Column(Text)
    valor_nuevo = Column(Text)
    fecha = Column(DateTime, default=datetime.utcnow)

    proyecto = relationship("Proyecto", back_populates="historial")


class Comentario(Base):
    __tablename__ = "comentarios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    folio_ppm = Column(String(50), ForeignKey("proyectos.folio_ppm"), nullable=False)
    comentario = Column(Text, nullable=False)
    autor = Column(String(200))
    fecha = Column(DateTime, default=datetime.utcnow)

    proyecto = relationship("Proyecto", back_populates="comentarios")


class Presentacion(Base):
    __tablename__ = "presentaciones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    nombre_archivo = Column(String(300), nullable=False)
    tipo = Column(String(10), nullable=False)  # pptx | pdf | csv
    proyectos_incluidos = Column(Integer)
    generado_en = Column(DateTime, default=datetime.utcnow)
