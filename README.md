# mcp-banorte

Servidor **MCP (Model Context Protocol)** en Python con transporte **HTTP/SSE**, pensado para integrarse con aplicaciones propias. Expone herramientas organizadas en dos categorías: **utilidades base** (archivos, base de datos, APIs, datos, PDFs) y **features de negocio** (cada una en su propia carpeta con toda su lógica encapsulada).

---

## Tabla de contenidos

- [Arquitectura](#arquitectura)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Convención de features](#convención-de-features)
- [Requisitos](#requisitos)
- [Inicio rápido](#inicio-rápido)
  - [Desarrollo local](#desarrollo-local)
  - [Docker](#docker)
- [Variables de entorno](#variables-de-entorno)
- [Referencia de herramientas (Tools)](#referencia-de-herramientas-tools)
  - [Utilidades base](#utilidades-base)
    - [Archivos](#archivos)
    - [Database](#database)
    - [APIs](#apis)
    - [Datos](#datos)
    - [Reportes PDF](#reportes-pdf)
  - [Features de negocio](#features-de-negocio)
    - [PPM — Project Portfolio Management](#ppm--project-portfolio-management)
- [Conectar tu app al servidor](#conectar-tu-app-al-servidor)
- [Cómo agregar una nueva feature](#cómo-agregar-una-nueva-feature)
- [Servicios Docker](#servicios-docker)
- [Seguridad](#seguridad)

---

## Arquitectura

```
Tu app / LLM
     │
     │  GET  /sse        ← stream Server-Sent Events
     │  POST /messages/  ← mensajes JSON-RPC
     ▼
┌─────────────────────────────────┐
│        mcp-banorte:8000         │
│  FastMCP  (HTTP/SSE transport)  │
│                                 │
│  tools/archivos   tools/datos   │
│  tools/database   tools/reportes│
│  tools/apis                     │
└──────────────┬──────────────────┘
               │
       ┌───────┴────────┐
       │  PostgreSQL:5432│
       └────────────────┘
```

**Transporte SSE** — el servidor expone dos endpoints permanentes:

> Cada feature nueva se integra como un bloque independiente; las utilidades base (archivos, BD, APIs) son transversales y cualquier feature puede usarlas.

| Método | Ruta         | Uso                                          |
|--------|--------------|----------------------------------------------|
| `GET`  | `/sse`       | El cliente abre una conexión SSE persistente |
| `POST` | `/messages/` | El cliente envía mensajes JSON-RPC           |

---

## Estructura del proyecto

```
mcp-banorte/
├── src/
│   ├── __init__.py
│   ├── config.py          # Settings con pydantic-settings (lee .env)
│   ├── server.py          # Instancia global: mcp = FastMCP(...)
│   ├── main.py            # Entry point: registra tools y arranca SSE
│   └── tools/
│       │
│       ├── # ── Utilidades base (transversales) ──────────────────
│       ├── archivos.py    # Operaciones de sistema de archivos
│       ├── database.py    # Operaciones SQL async
│       ├── apis.py        # Cliente HTTP genérico + helpers Banorte
│       ├── datos.py       # Procesamiento de datos con pandas
│       ├── reportes.py    # Generación de PDFs con ReportLab
│       │
│       └── # ── Features de negocio (una carpeta por feature) ────
│           └── ppm/                  # Feature: Project Portfolio Management
│               ├── __init__.py       # Tools MCP: generar/listar presentaciones
│               ├── excel_reader.py   # Lógica interna: lee Excel PPM
│               └── ppt_writer.py     # Lógica interna: construye el PPTX
│
├── init-db/               # Scripts SQL ejecutados al levantar PostgreSQL
├── data/
│   └── ppm/               # Plantillas de la feature PPM
│       ├── master.pptx
│       └── plantilla_ppm.xlsx
├── output/
│   ├── pdfs/              # PDFs generados por reportes.py
│   └── ppm/               # PPTX generados por la feature PPM
├── Dockerfile             # Multi-stage, usuario no-root
├── docker-compose.yml     # Servicios: mcp + db + pgadmin (perfil dev)
├── requirements.txt
├── .env.example
├── .gitignore
└── .dockerignore
```

---

## Convención de features

Cada funcionalidad de negocio es una **carpeta independiente** dentro de `src/tools/`. La regla es simple:

```
src/tools/<nombre-feature>/
  __init__.py        ← OBLIGATORIO: aquí van todos los @mcp.tool() de la feature
  modulo_interno.py  ← lógica interna (no expone tools directamente)
  otro_modulo.py     ← más lógica interna si se necesita

data/<nombre-feature>/
  plantilla.xlsx     ← archivos de datos / templates propios de la feature

output/<nombre-feature>/
  ...                ← archivos generados por la feature
```

Y en [src/main.py](src/main.py) se agrega **una sola línea** para registrar la feature:

```python
import src.tools.nombre_feature   # registra todos sus @mcp.tool()
```

Eso es todo. El servidor detecta automáticamente los tools al arrancar.

---

## Requisitos

- Python 3.12+
- Docker + Docker Compose (para el stack completo)

Dependencias principales:

| Paquete              | Uso                                     |
|----------------------|-----------------------------------------|
| `mcp[cli]>=1.3.0`    | Framework MCP + FastMCP                 |
| `sqlalchemy>=2.0`    | ORM async (PostgreSQL / SQLite)         |
| `asyncpg`            | Driver async PostgreSQL                 |
| `aiosqlite`          | Driver async SQLite (dev)               |
| `httpx>=0.27`        | Cliente HTTP async                      |
| `pandas>=2.2`        | Procesamiento de datos                  |
| `reportlab>=4.2`     | Generación de PDFs                      |
| `python-pptx>=1.0`   | Generación de presentaciones (feature PPM) |
| `openpyxl>=3.1`      | Lectura de Excel (feature PPM)          |
| `pydantic-settings`  | Gestión de configuración                |

---

## Inicio rápido

### Desarrollo local

```bash
# 1. Clonar y entrar al directorio
cd mcp-banorte

# 2. Crear entorno virtual e instalar dependencias
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# 4. Arrancar el servidor (SQLite por defecto)
python -m src.main
```

El servidor queda disponible en `http://localhost:8000`.

### Docker

```bash
# 1. Copiar y editar variables de entorno
cp .env.example .env

# 2. Levantar stack completo (MCP + PostgreSQL)
docker compose up --build

# 3. Levantar con pgAdmin (solo desarrollo)
docker compose --profile dev up --build
```

| Servicio  | URL                          |
|-----------|------------------------------|
| MCP SSE   | `http://localhost:8000/sse`  |
| pgAdmin   | `http://localhost:5050`      |

> **pgAdmin** — credenciales por defecto: `admin@banorte.local` / `admin`

---

## Variables de entorno

Copia `.env.example` a `.env` y ajusta los valores:

| Variable                | Default                              | Descripción                         |
|-------------------------|--------------------------------------|-------------------------------------|
| `MCP_HOST`              | `0.0.0.0`                            | Interfaz de escucha del servidor    |
| `MCP_PORT`              | `8000`                               | Puerto del servidor                 |
| `MCP_SERVER_NAME`       | `mcp-banorte`                        | Nombre del servidor MCP             |
| `DATABASE_URL`          | `sqlite+aiosqlite:///./data/mcp.db`  | Cadena de conexión a BD             |
| `FILES_BASE_DIR`        | `./data`                             | Raíz para operaciones de archivos   |
| `OUTPUT_DIR`            | `./output`                           | Directorio de salida de PDFs        |
| `BANORTE_API_BASE_URL`  | _(vacío)_                            | URL base de la API de Banorte       |
| `BANORTE_API_KEY`       | _(vacío)_                            | API key para autenticación          |
| `BANORTE_API_SECRET`    | _(vacío)_                            | Secret para autenticación           |
| `BANORTE_TIMEOUT`       | `30`                                 | Timeout HTTP en segundos            |
| `LOG_LEVEL`             | `INFO`                               | Nivel de log (DEBUG/INFO/WARNING)   |

Para **Docker con PostgreSQL** la `DATABASE_URL` se inyecta directamente en `docker-compose.yml`:

```
postgresql+asyncpg://mcp_user:mcp_password@db:5432/mcp_db
```

---

## Referencia de herramientas (Tools)

### Utilidades base

Herramientas transversales disponibles para cualquier contexto o feature.

### Archivos

> Módulo: [src/tools/archivos.py](src/tools/archivos.py) — todas las rutas son **relativas** a `FILES_BASE_DIR`. Incluye protección contra path traversal.

| Tool                | Parámetros principales                          | Descripción                              |
|---------------------|-------------------------------------------------|------------------------------------------|
| `leer_archivo`      | `ruta`                                          | Lee y devuelve el contenido de un archivo de texto |
| `escribir_archivo`  | `ruta`, `contenido`, `sobrescribir=False`       | Escribe texto en un archivo; crea directorios intermedios |
| `listar_directorio` | `ruta=""`                                       | Lista entradas de un directorio (nombre, tipo, tamaño) |
| `buscar_archivos`   | `patron`, `directorio=""`                       | Busca archivos por patrón glob (ej. `**/*.csv`) |
| `eliminar_archivo`  | `ruta`                                          | Elimina un archivo (no directorios)      |
| `mover_archivo`     | `origen`, `destino`                             | Mueve o renombra un archivo              |

---

### Database

> Módulo: [src/tools/database.py](src/tools/database.py) — usa SQLAlchemy async. Compatible con **PostgreSQL** y **SQLite**.

| Tool                  | Parámetros principales                                  | Descripción                                    |
|-----------------------|---------------------------------------------------------|------------------------------------------------|
| `ejecutar_consulta`   | `sql`, `parametros=None`                                | Ejecuta cualquier SQL; devuelve filas o `{filas_afectadas}` |
| `insertar_registro`   | `tabla`, `datos: dict`                                  | Inserta un registro con parámetros nombrados   |
| `actualizar_registro` | `tabla`, `datos`, `condicion`, `parametros_condicion`   | UPDATE con condición parametrizada             |
| `eliminar_registro`   | `tabla`, `condicion`, `parametros=None`                 | DELETE con condición parametrizada             |
| `listar_tablas`       | _(sin parámetros)_                                      | Lista todas las tablas del esquema público     |

**Ejemplo de `ejecutar_consulta`:**
```json
{
  "sql": "SELECT * FROM clientes WHERE ciudad = :ciudad LIMIT 10",
  "parametros": { "ciudad": "Monterrey" }
}
```

---

### APIs

> Módulo: [src/tools/apis.py](src/tools/apis.py) — cliente HTTP genérico (`httpx`) y helpers pre-autenticados para la API de Banorte.

**Genéricos:**

| Tool          | Parámetros principales                    | Descripción              |
|---------------|-------------------------------------------|--------------------------|
| `http_get`    | `url`, `headers`, `params`, `timeout`     | Petición GET             |
| `http_post`   | `url`, `body`, `headers`, `timeout`       | Petición POST JSON       |
| `http_put`    | `url`, `body`, `headers`, `timeout`       | Petición PUT JSON        |
| `http_delete` | `url`, `headers`, `timeout`               | Petición DELETE          |

**Banorte (usan `BANORTE_API_KEY` y `BANORTE_API_SECRET` automáticamente):**

| Tool            | Parámetros principales  | Descripción                          |
|-----------------|-------------------------|--------------------------------------|
| `banorte_get`   | `endpoint`, `params`    | GET autenticado a la API de Banorte  |
| `banorte_post`  | `endpoint`, `payload`   | POST autenticado a la API de Banorte |

---

### Datos

> Módulo: [src/tools/datos.py](src/tools/datos.py) — procesamiento con **pandas**. Los datos se pasan como texto (CSV o JSON), no como rutas de archivo.

| Tool                  | Parámetros principales                                         | Descripción                                      |
|-----------------------|----------------------------------------------------------------|--------------------------------------------------|
| `leer_csv`            | `contenido`, `separador=","`, `encoding="utf-8"`              | Parsea CSV; devuelve estructura y primeras filas |
| `leer_json_datos`     | `contenido`                                                    | Parsea JSON (lista o dict); devuelve estructura  |
| `filtrar_datos`       | `contenido_csv`, `columna`, `operador`, `valor`               | Filtra filas por condición; devuelve CSV         |
| `agregar_datos`       | `contenido_csv`, `columnas_grupo`, `columna_valor`, `funcion` | Group-by + agregación; devuelve CSV              |
| `convertir_formato`   | `contenido`, `formato_origen`, `formato_destino`              | Convierte entre CSV ↔ JSON ↔ Markdown            |
| `estadisticas_columna`| `contenido_csv`, `columna`                                    | Stats descriptivas de una columna               |

**Operadores disponibles en `filtrar_datos`:**
`==`, `!=`, `>`, `>=`, `<`, `<=`, `contiene`, `empieza_con`, `termina_con`

**Funciones disponibles en `agregar_datos`:**
`suma`, `promedio`, `conteo`, `maximo`, `minimo`, `mediana`

---

### Reportes PDF

> Módulo: [src/tools/reportes.py](src/tools/reportes.py) — genera PDFs con **ReportLab**. Los archivos se guardan en `OUTPUT_DIR/pdfs/`. Estilo corporativo con colores Banorte (`#C8102E` rojo, `#1A1A2E` azul oscuro).

| Tool                     | Descripción                                                        |
|--------------------------|--------------------------------------------------------------------|
| `generar_reporte_tabla`  | Reporte con una tabla de datos (encabezado + filas)               |
| `generar_reporte_texto`  | Reporte narrativo con secciones de título + párrafo              |
| `generar_reporte_mixto`  | Mezcla libre de textos, tablas, espaciadores y separadores        |
| `listar_reportes`        | Lista los PDFs generados con nombre, tamaño y fecha              |

**Tipos de elementos para `generar_reporte_mixto`:**
```json
[
  { "tipo": "texto",     "contenido": "Análisis Q1 2025", "estilo": "heading1" },
  { "tipo": "separador" },
  { "tipo": "tabla",     "columnas": ["Cuenta", "Saldo"], "filas": [["001", "10000"]] },
  { "tipo": "espacio",   "alto_cm": 0.5 },
  { "tipo": "texto",     "contenido": "Conclusiones..." }
]
```

---

### Features de negocio

---

### PPM — Project Portfolio Management

> Feature: [src/tools/ppm/](src/tools/ppm/) — Genera presentaciones PowerPoint de seguimiento de proyectos a partir de un Excel con hojas `RESUMEN`, `GANTT`, `RIESGOS` y `ETAPAS`.
>
> Plantillas en [data/ppm/](data/ppm/) · Salida en `output/ppm/`

| Tool                        | Parámetros principales                            | Descripción                                         |
|-----------------------------|---------------------------------------------------|-----------------------------------------------------|
| `generar_presentacion_ppm`  | `nombre_archivo`, `excel_path`, `solo_activos`    | Genera un PPTX con un slide por proyecto            |
| `listar_proyectos_ppm`      | `excel_path`                                      | Lista proyectos del Excel con avance y estado       |
| `listar_presentaciones_ppm` | _(sin parámetros)_                                | Lista los PPTX generados en `output/ppm/`           |

**Estructura del Excel PPM (`plantilla_ppm.xlsx`):**

| Hoja      | Contenido                                                       |
|-----------|-----------------------------------------------------------------|
| `RESUMEN` | Un registro por proyecto: folio, nombre, objetivo, costos, fechas, avance, lider |
| `GANTT`   | Actividades por proyecto: responsable, fechas inicio/fin, avance, color |
| `RIESGOS` | Riesgos por proyecto: descripción, responsable, mitigación, fecha |
| `ETAPAS`  | Estado de cada etapa del ciclo de vida del proyecto             |

**Flujo de uso:**
```
1. Llenar plantilla_ppm.xlsx con los datos del portafolio
2. Llamar a generar_presentacion_ppm(nombre_archivo="reporte_marzo")
3. El PPTX se guarda en output/ppm/reporte_marzo.pptx
```

---

## Conectar tu app al servidor

El servidor usa el protocolo MCP estándar sobre SSE. Ejemplo con el SDK de Python:

```python
from mcp.client.sse import sse_client
from mcp import ClientSession

async def main():
    async with sse_client("http://localhost:8000/sse") as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            # Listar herramientas disponibles
            tools = await session.list_tools()

            # Invocar una herramienta
            result = await session.call_tool(
                "leer_archivo",
                {"ruta": "datos/clientes.csv"}
            )
            print(result.content)
```

Para conectar desde **Claude Desktop** u otro cliente MCP compatible:

```json
{
  "mcpServers": {
    "mcp-banorte": {
      "url": "http://localhost:8000/sse"
    }
  }
}
```

---

## Cómo agregar una nueva feature

**Paso 1** — Crear la carpeta de la feature:
```
src/tools/mi_feature/
  __init__.py        ← tools MCP
  logica_interna.py  ← código de negocio (sin decoradores MCP)

data/mi_feature/     ← plantillas o archivos de entrada
output/mi_feature/   ← archivos generados
```

**Paso 2** — En `__init__.py`, importar `mcp` y definir los tools:
```python
# src/tools/mi_feature/__init__.py
from typing import Annotated
from src.server import mcp
from src.tools.mi_feature.logica_interna import hacer_algo

@mcp.tool()
def mi_herramienta(
    param: Annotated[str, "Descripción del parámetro para el LLM"],
) -> str:
    """Descripción clara de lo que hace esta herramienta."""
    return hacer_algo(param)
```

**Paso 3** — Registrar en [src/main.py](src/main.py) con una línea:
```python
import src.tools.mi_feature   # noqa: F401
```

**Paso 4** — Si la feature tiene dependencias nuevas, agregarlas a `requirements.txt` con un comentario que indique a qué feature pertenecen.

El servidor detecta automáticamente los tools al siguiente arranque.

---

## Servicios Docker

| Servicio      | Imagen               | Puerto | Perfil  | Descripción                         |
|---------------|----------------------|--------|---------|-------------------------------------|
| `mcp`         | build local          | 8000   | siempre | Servidor MCP principal              |
| `db`          | `postgres:16-alpine` | —      | siempre | PostgreSQL (solo accesible internamente) |
| `pgadmin`     | `dpage/pgadmin4`     | 5050   | `dev`   | Interfaz web para PostgreSQL        |

**Scripts SQL de inicialización:** coloca archivos `.sql` en `init-db/` y se ejecutarán automáticamente la primera vez que levante el contenedor `db`.

**Volúmenes persistentes:**

| Volumen         | Montado en   | Contenido                    |
|-----------------|--------------|------------------------------|
| `postgres_data` | (interno)    | Datos de PostgreSQL          |
| `mcp_data`      | `/app/data`  | Archivos de trabajo          |
| `mcp_output`    | `/app/output`| PDFs y otros archivos de salida |

---

## Seguridad

- **Path traversal** — `archivos.py` resuelve y valida que toda ruta esté dentro de `FILES_BASE_DIR` antes de operar.
- **Parámetros SQL** — `database.py` usa parámetros nombrados de SQLAlchemy (`:nombre`), nunca interpolación directa.
- **Credenciales** — nunca se hardcodean en el código; se leen del entorno con `pydantic-settings`.
- **Usuario Docker** — el contenedor corre con usuario no-root (`mcp:mcp`).
- **Red interna** — PostgreSQL no expone puertos al host; solo es accesible desde la red `mcp_net`.

---

> Última actualización: 2026-03-03 — Feature PPM integrada, convención de features establecida.
