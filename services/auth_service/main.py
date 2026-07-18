from fastapi import FastAPI
from database import engine, Base
from routers import auth

# Initialize DB tables (for simpler setups, but usually done via alembic migrations in production)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Auth Service")

app.include_router(auth.router)

@app.get("/health")
def health_check():
    return {"status": "ok"}
