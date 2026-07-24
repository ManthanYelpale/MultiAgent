# AI Business OS — Backend

FastAPI backend covering **Phase 0 (scaffolding)** and **Phase 1 (auth + file upload)**
of the AI Business OS project. This is the foundation the AI chat / RAG / forecasting /
report-generation phases will build on top of.

## Stack
FastAPI · SQLAlchemy 2.0 · Alembic · Pydantic v2 · PostgreSQL · JWT (python-jose) · Pandas

## Project structure

```
app/
  main.py                        # FastAPI app, CORS, router registration
  core/
    config.py                    # Settings loaded from .env (pydantic-settings)
    security.py                  # Password hashing + JWT create/decode
  db/
    base.py                      # SQLAlchemy declarative Base
    session.py                   # Engine + SessionLocal + get_db() dependency
  models/
    user.py, uploaded_file.py    # SQLAlchemy ORM models
  schemas/
    user.py, token.py, uploaded_file.py   # Pydantic request/response models
  crud/
    user.py, uploaded_file.py    # DB read/write logic, kept separate from routes
  api/
    deps.py                      # get_current_user() dependency (JWT auth guard)
    v1/
      api.py                     # Centralized v1 APIRouter aggregator
      endpoints/
        health.py                # GET /health
        auth.py                  # signup / login / me
        files.py                 # upload + list + get uploaded files
alembic/                         # DB migrations (initial tables already included)
uploads/                         # Uploaded files land here in dev
requirements.txt
docker-compose.yml               # Postgres + backend, one command to run both
Dockerfile
.env.example
```

The layering (`routes` → `crud` → `models`) keeps request handling, DB logic, and
data models separate — this is what lets you add RAG/forecasting/reports later
without route files turning into a mess of raw SQLAlchemy calls.

## Running locally (with Docker — easiest)

```bash
cp .env.example .env
# edit .env if you want, defaults work with docker-compose as-is

docker compose up --build
```

Then run migrations once the containers are up:

```bash
docker compose exec backend alembic upgrade head
```

API docs: http://localhost:8000/docs

## Running locally (without Docker)

Requires a local Postgres running with a database matching your `.env`.

```bash
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env
# edit DATABASE_URL to point at your local Postgres

alembic upgrade head
uvicorn app.main:app --reload
```

## API overview

| Method | Path                  | Auth | Description                          |
|--------|------------------------|------|---------------------------------------|
| GET    | /api/v1/health          | No   | Health check                          |
| POST   | /api/v1/auth/signup     | No   | Create a user                         |
| POST   | /api/v1/auth/login      | No   | Get a JWT (form fields: username, password) |
| GET    | /api/v1/auth/me         | Yes  | Current user's profile                |
| POST   | /api/v1/files/upload    | Yes  | Upload CSV/Excel/PDF                  |
| GET    | /api/v1/files           | Yes  | List your uploaded files              |
| GET    | /api/v1/files/{id}      | Yes  | Get one file's metadata               |

All authenticated routes expect `Authorization: Bearer <token>`.

## What's already working
- JWT auth (signup/login/me) with bcrypt password hashing
- CSV/Excel upload with Pandas-based row/column/dtype preview stored in Postgres
- PDF upload (stored, not yet parsed — that's the RAG phase)
- Alembic migrations set up and an initial migration already written
- CORS configured for a local Vite frontend (`http://localhost:5173`)

## Next steps (later phases)
- Data cleaning + dashboard auto-generation (Phase 2)
- AI chat / RAG / SQL generator via Groq + FAISS + bge-small embeddings (Phase 3)
- Forecasting + anomaly detection with scikit-learn/XGBoost (Phase 4)
- PDF/PPT report generation with ReportLab + python-pptx (Phase 5)
- Deploy: Render/Koyeb (backend) + Supabase/Neon (DB) + Vercel (frontend)

## Notes
- `SECRET_KEY` in `.env.example` is a placeholder — generate a real one before
  deploying anywhere (`python -c "import secrets; print(secrets.token_hex(32))"`).
- File storage is local `uploads/` for now; swap for Supabase Storage later
  without touching route logic — only the save/read calls in `upload.py` change.
