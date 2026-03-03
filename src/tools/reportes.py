"""
Tool: Reportes PDF
Generación de reportes PDF con tablas, texto y estilos corporativos.
Usa ReportLab como motor de renderizado.
"""

import io
import os
from datetime import datetime
from pathlib import Path
from typing import Annotated, Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate,
    Table,
    TableStyle,
    Paragraph,
    Spacer,
    HRFlowable,
)

from src.config import settings
from src.server import mcp

OUTPUT_DIR = Path(settings.output_dir) / "pdfs"


def _ensure_output_dir() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


# ── Estilos corporativos ──────────────────────────────────────────────────────

# Colores Banorte (ajusta según el brand book)
COLOR_PRIMARIO = colors.HexColor("#C8102E")   # Rojo Banorte
COLOR_SECUNDARIO = colors.HexColor("#1A1A2E")  # Azul oscuro
COLOR_FONDO_HEADER = colors.HexColor("#F5F5F5")
COLOR_BORDE = colors.HexColor("#CCCCCC")


def _base_table_style() -> TableStyle:
    return TableStyle([
        # Encabezado
        ("BACKGROUND", (0, 0), (-1, 0), COLOR_PRIMARIO),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
        # Datos
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, COLOR_FONDO_HEADER]),
        # Bordes
        ("GRID", (0, 0), (-1, -1), 0.5, COLOR_BORDE),
        ("BOX", (0, 0), (-1, -1), 1, COLOR_PRIMARIO),
        # Padding
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ])


def _build_doc(nombre_archivo: str, orientacion: str = "portrait") -> SimpleDocTemplate:
    _ensure_output_dir()
    path = OUTPUT_DIR / nombre_archivo
    pagesize = A4 if orientacion == "portrait" else (A4[1], A4[0])
    return SimpleDocTemplate(
        str(path),
        pagesize=pagesize,
        rightMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )


def _header_elements(titulo: str, subtitulo: str = "") -> list:
    styles = getSampleStyleSheet()
    titulo_style = ParagraphStyle(
        "TituloCorp",
        parent=styles["Title"],
        fontSize=18,
        textColor=COLOR_SECUNDARIO,
        spaceAfter=4,
    )
    sub_style = ParagraphStyle(
        "SubtituloCorp",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.grey,
        spaceAfter=2,
    )
    fecha_style = ParagraphStyle(
        "Fecha",
        parent=styles["Normal"],
        fontSize=8,
        textColor=colors.grey,
        alignment=2,  # right
    )
    elementos = [
        Paragraph(titulo, titulo_style),
        HRFlowable(width="100%", thickness=2, color=COLOR_PRIMARIO, spaceAfter=4),
    ]
    if subtitulo:
        elementos.append(Paragraph(subtitulo, sub_style))
    elementos.append(
        Paragraph(f"Generado: {datetime.now().strftime('%d/%m/%Y %H:%M')}", fecha_style)
    )
    elementos.append(Spacer(1, 0.5 * cm))
    return elementos


# ── Tools ────────────────────────────────────────────────────────────────────


@mcp.tool()
def generar_reporte_tabla(
    titulo: Annotated[str, "Título principal del reporte"],
    columnas: Annotated[list[str], "Nombres de las columnas de la tabla"],
    filas: Annotated[list[list[Any]], "Filas de datos (lista de listas)"],
    nombre_archivo: Annotated[str, "Nombre del archivo PDF de salida (sin extensión)"],
    subtitulo: Annotated[str, "Subtítulo o descripción opcional"] = "",
    orientacion: Annotated[str, "Orientación: 'portrait' o 'landscape'"] = "portrait",
) -> str:
    """
    Genera un reporte PDF con una tabla de datos con estilo corporativo.
    Devuelve la ruta relativa del archivo generado.
    """
    nombre_pdf = f"{nombre_archivo}.pdf"
    doc = _build_doc(nombre_pdf, orientacion)

    # Construir tabla
    table_data = [columnas] + [[str(cell) for cell in row] for row in filas]
    table = Table(table_data, repeatRows=1)
    table.setStyle(_base_table_style())

    story = _header_elements(titulo, subtitulo)
    story.append(table)
    story.append(Spacer(1, 0.5 * cm))

    doc.build(story)
    ruta_relativa = str(Path("output") / "pdfs" / nombre_pdf)
    return f"PDF generado: {ruta_relativa} ({len(filas)} filas)"


@mcp.tool()
def generar_reporte_texto(
    titulo: Annotated[str, "Título principal del reporte"],
    secciones: Annotated[
        list[dict[str, str]],
        "Lista de secciones, cada una con 'titulo' y 'contenido'",
    ],
    nombre_archivo: Annotated[str, "Nombre del archivo PDF de salida (sin extensión)"],
    subtitulo: Annotated[str, "Subtítulo o descripción opcional"] = "",
) -> str:
    """
    Genera un reporte PDF con secciones de texto. Ideal para informes narrativos.
    Cada sección tiene un título y un párrafo de contenido.
    """
    nombre_pdf = f"{nombre_archivo}.pdf"
    doc = _build_doc(nombre_pdf)
    styles = getSampleStyleSheet()

    seccion_style = ParagraphStyle(
        "SeccionTitulo",
        parent=styles["Heading2"],
        textColor=COLOR_SECUNDARIO,
        spaceBefore=12,
        spaceAfter=4,
    )
    cuerpo_style = ParagraphStyle(
        "Cuerpo",
        parent=styles["Normal"],
        fontSize=10,
        leading=14,
        spaceAfter=6,
    )

    story = _header_elements(titulo, subtitulo)

    for seccion in secciones:
        if seccion.get("titulo"):
            story.append(Paragraph(seccion["titulo"], seccion_style))
            story.append(HRFlowable(width="100%", thickness=0.5, color=COLOR_BORDE))
        if seccion.get("contenido"):
            # Reemplazar saltos de línea por <br/> para ReportLab
            texto = seccion["contenido"].replace("\n", "<br/>")
            story.append(Paragraph(texto, cuerpo_style))

    doc.build(story)
    ruta_relativa = str(Path("output") / "pdfs" / nombre_pdf)
    return f"PDF generado: {ruta_relativa}"


@mcp.tool()
def generar_reporte_mixto(
    titulo: Annotated[str, "Título del reporte"],
    nombre_archivo: Annotated[str, "Nombre del PDF de salida (sin extensión)"],
    elementos: Annotated[
        list[dict[str, Any]],
        (
            "Lista de elementos en orden. Cada elemento es un dict con 'tipo' y datos.\n"
            "Tipos soportados:\n"
            "  {'tipo': 'texto', 'contenido': '...', 'estilo': 'normal|heading1|heading2'}\n"
            "  {'tipo': 'tabla', 'columnas': [...], 'filas': [[...], ...]}\n"
            "  {'tipo': 'espacio', 'alto_cm': 0.5}\n"
            "  {'tipo': 'separador'}"
        ),
    ],
    subtitulo: Annotated[str, "Subtítulo opcional"] = "",
) -> str:
    """
    Genera un reporte PDF con una mezcla libre de texto, tablas y espaciadores.
    """
    nombre_pdf = f"{nombre_archivo}.pdf"
    doc = _build_doc(nombre_pdf)
    styles = getSampleStyleSheet()

    story = _header_elements(titulo, subtitulo)

    for elem in elementos:
        tipo = elem.get("tipo", "")

        if tipo == "texto":
            estilo_nombre = elem.get("estilo", "normal")
            style_map = {
                "normal": styles["Normal"],
                "heading1": styles["Heading1"],
                "heading2": styles["Heading2"],
            }
            style = style_map.get(estilo_nombre, styles["Normal"])
            texto = elem.get("contenido", "").replace("\n", "<br/>")
            story.append(Paragraph(texto, style))

        elif tipo == "tabla":
            columnas = elem.get("columnas", [])
            filas = elem.get("filas", [])
            table_data = [columnas] + [[str(c) for c in fila] for fila in filas]
            table = Table(table_data, repeatRows=1)
            table.setStyle(_base_table_style())
            story.append(table)

        elif tipo == "espacio":
            alto = float(elem.get("alto_cm", 0.5))
            story.append(Spacer(1, alto * cm))

        elif tipo == "separador":
            story.append(HRFlowable(width="100%", thickness=1, color=COLOR_BORDE, spaceAfter=4))

    doc.build(story)
    ruta_relativa = str(Path("output") / "pdfs" / nombre_pdf)
    return f"PDF generado: {ruta_relativa}"


@mcp.tool()
def listar_reportes() -> list[dict]:
    """Lista todos los reportes PDF generados en el directorio de salida."""
    _ensure_output_dir()
    reportes = []
    for pdf in sorted(OUTPUT_DIR.glob("*.pdf")):
        stat = pdf.stat()
        reportes.append({
            "nombre": pdf.name,
            "ruta": str(Path("output") / "pdfs" / pdf.name),
            "tamaño_kb": round(stat.st_size / 1024, 1),
            "creado": datetime.fromtimestamp(stat.st_ctime).strftime("%d/%m/%Y %H:%M"),
        })
    return reportes
