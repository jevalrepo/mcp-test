"""
Tool: Datos
Procesamiento, transformación y análisis de datos con pandas.
Soporta CSV, JSON y Excel.
"""

import io
import json
from typing import Annotated, Any, Literal

import pandas as pd

from src.server import mcp

# ── Tools ────────────────────────────────────────────────────────────────────


@mcp.tool()
def leer_csv(
    contenido: Annotated[str, "Contenido del CSV como texto"],
    separador: Annotated[str, "Separador de columnas"] = ",",
    encoding: Annotated[str, "Encoding del archivo"] = "utf-8",
) -> dict:
    """
    Parsea un CSV y devuelve su estructura: columnas, tipos, primeras filas y estadísticas.
    """
    df = pd.read_csv(io.StringIO(contenido), sep=separador, encoding=encoding)
    return _df_resumen(df)


@mcp.tool()
def leer_json_datos(
    contenido: Annotated[str, "Contenido JSON como texto (lista de objetos o dict)"],
) -> dict:
    """
    Parsea datos JSON y devuelve su estructura y estadísticas.
    """
    data = json.loads(contenido)
    df = pd.DataFrame(data) if isinstance(data, list) else pd.DataFrame([data])
    return _df_resumen(df)


@mcp.tool()
def filtrar_datos(
    contenido_csv: Annotated[str, "Contenido CSV a filtrar"],
    columna: Annotated[str, "Nombre de la columna por la que filtrar"],
    operador: Annotated[
        Literal["==", "!=", ">", ">=", "<", "<=", "contiene", "empieza_con", "termina_con"],
        "Operador de comparación",
    ],
    valor: Annotated[str, "Valor de comparación (se convierte al tipo de la columna)"],
    separador: Annotated[str, "Separador CSV"] = ",",
) -> str:
    """Filtra filas de un CSV según una condición y devuelve el resultado como CSV."""
    df = pd.read_csv(io.StringIO(contenido_csv), sep=separador)

    if columna not in df.columns:
        raise ValueError(f"La columna '{columna}' no existe. Columnas disponibles: {list(df.columns)}")

    col = df[columna]

    ops = {
        "==": col == _cast(valor, col),
        "!=": col != _cast(valor, col),
        ">":  col > _cast(valor, col),
        ">=": col >= _cast(valor, col),
        "<":  col < _cast(valor, col),
        "<=": col <= _cast(valor, col),
        "contiene":     col.astype(str).str.contains(valor, na=False),
        "empieza_con":  col.astype(str).str.startswith(valor),
        "termina_con":  col.astype(str).str.endswith(valor),
    }

    filtrado = df[ops[operador]]
    return filtrado.to_csv(index=False, sep=separador)


@mcp.tool()
def agregar_datos(
    contenido_csv: Annotated[str, "Contenido CSV con los datos"],
    columnas_grupo: Annotated[list[str], "Columnas por las que agrupar"],
    columna_valor: Annotated[str, "Columna numérica a agregar"],
    funcion: Annotated[
        Literal["suma", "promedio", "conteo", "maximo", "minimo", "mediana"],
        "Función de agregación",
    ],
    separador: Annotated[str, "Separador CSV"] = ",",
) -> str:
    """Agrupa un CSV y aplica una función de agregación. Devuelve el resultado como CSV."""
    df = pd.read_csv(io.StringIO(contenido_csv), sep=separador)

    funciones = {
        "suma":     "sum",
        "promedio": "mean",
        "conteo":   "count",
        "maximo":   "max",
        "minimo":   "min",
        "mediana":  "median",
    }

    resultado = df.groupby(columnas_grupo)[columna_valor].agg(funciones[funcion]).reset_index()
    resultado.columns = [*columnas_grupo, f"{columna_valor}_{funcion}"]
    return resultado.to_csv(index=False, sep=separador)


@mcp.tool()
def convertir_formato(
    contenido: Annotated[str, "Contenido de los datos a convertir"],
    formato_origen: Annotated[Literal["csv", "json"], "Formato de entrada"],
    formato_destino: Annotated[Literal["csv", "json", "markdown"], "Formato de salida"],
    separador_csv: Annotated[str, "Separador para CSV (origen y destino)"] = ",",
) -> str:
    """Convierte datos entre formatos: CSV ↔ JSON ↔ Markdown."""
    # Leer
    if formato_origen == "csv":
        df = pd.read_csv(io.StringIO(contenido), sep=separador_csv)
    elif formato_origen == "json":
        data = json.loads(contenido)
        df = pd.DataFrame(data) if isinstance(data, list) else pd.DataFrame([data])
    else:
        raise ValueError(f"Formato origen no soportado: {formato_origen}")

    # Escribir
    if formato_destino == "csv":
        return df.to_csv(index=False, sep=separador_csv)
    elif formato_destino == "json":
        return df.to_json(orient="records", force_ascii=False, indent=2)
    elif formato_destino == "markdown":
        return df.to_markdown(index=False)
    else:
        raise ValueError(f"Formato destino no soportado: {formato_destino}")


@mcp.tool()
def estadisticas_columna(
    contenido_csv: Annotated[str, "Contenido CSV"],
    columna: Annotated[str, "Nombre de la columna a analizar"],
    separador: Annotated[str, "Separador CSV"] = ",",
) -> dict:
    """Calcula estadísticas descriptivas de una columna numérica o categórica."""
    df = pd.read_csv(io.StringIO(contenido_csv), sep=separador)

    if columna not in df.columns:
        raise ValueError(f"Columna '{columna}' no encontrada. Disponibles: {list(df.columns)}")

    col = df[columna]
    stats: dict[str, Any] = {
        "columna": columna,
        "tipo": str(col.dtype),
        "total_filas": len(col),
        "nulos": int(col.isna().sum()),
        "unicos": int(col.nunique()),
    }

    if pd.api.types.is_numeric_dtype(col):
        desc = col.describe()
        stats.update({
            "min": float(desc["min"]),
            "max": float(desc["max"]),
            "promedio": float(desc["mean"]),
            "mediana": float(col.median()),
            "desv_std": float(desc["std"]),
            "percentil_25": float(desc["25%"]),
            "percentil_75": float(desc["75%"]),
        })
    else:
        stats["top_valores"] = col.value_counts().head(10).to_dict()

    return stats


# ── Helpers internos ─────────────────────────────────────────────────────────


def _cast(valor: str, serie: pd.Series) -> Any:
    """Intenta convertir el valor al tipo de la serie."""
    try:
        if pd.api.types.is_numeric_dtype(serie):
            return float(valor)
        return valor
    except (ValueError, TypeError):
        return valor


def _df_resumen(df: pd.DataFrame) -> dict:
    """Genera un resumen del DataFrame para devolver al LLM."""
    return {
        "filas": len(df),
        "columnas": len(df.columns),
        "nombres_columnas": list(df.columns),
        "tipos": {col: str(dtype) for col, dtype in df.dtypes.items()},
        "nulos_por_columna": df.isna().sum().to_dict(),
        "primeras_filas": df.head(5).to_dict(orient="records"),
    }
