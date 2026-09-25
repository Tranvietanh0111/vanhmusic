# VanhMusic

Premium music streaming app starter.

## Structure

- frontend: React + TypeScript + Vite
- backend: FastAPI starter

## Run frontend

```bash
cd frontend
npm install
npm run dev
```

## Run backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
