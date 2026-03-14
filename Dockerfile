# ── Stage 0: Build frontend ──────────────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /frontend

COPY frontend/package*.json ./
COPY frontend/scripts/ ./scripts/
RUN npm ci
COPY frontend/ ./
RUN npm run build


# ── Stage 1: dependencias Python ─────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /app

# Instalar dependencias del sistema para compilar paquetes nativos
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ── Stage 2: imagen final ────────────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# Librerías de runtime (sin compiladores)
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Copiar dependencias instaladas
COPY --from=builder /install /usr/local

# Copiar código fuente
COPY src/ ./src/

# Copiar frontend compilado
COPY --from=frontend-builder /frontend/dist ./frontend/dist

# Directorios de trabajo (montados como volúmenes en producción)
RUN mkdir -p data output/pdfs output/ppm

# Usuario no-root
RUN addgroup --system mcp && adduser --system --ingroup mcp mcp
RUN chown -R mcp:mcp /app
USER mcp

# Puerto SSE
EXPOSE 8000

# Variables por defecto (sobrescribibles en docker-compose)
ENV MCP_HOST=0.0.0.0 \
    MCP_PORT=8000 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/archivos')" || exit 1

CMD ["python", "-m", "src.main"]
