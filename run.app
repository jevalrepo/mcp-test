Front:
cd mcp-banorterontend
npm run dev

Backend:
.venv\Scripts\python.exe -m src.main

Docker:
docker compose up -d

Ngrok:
ngrok http 8000 --host-header="localhost:8000"
