from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.core.config import get_settings
from app.db import init_db
from app.routers import alerts, auth, backtests, scoring, stock_pools, strategies, teams, tonghuashun


def create_app() -> FastAPI:
    init_db()
    app = FastAPI(title="Short-Term Stock Analysis Dashboard")
    origins = [item.strip() for item in get_settings().cors_origins.split(",") if item.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(auth.router)
    app.include_router(teams.router)
    app.include_router(stock_pools.router)
    app.include_router(strategies.router)
    app.include_router(scoring.router)
    app.include_router(alerts.router)
    app.include_router(backtests.router)
    app.include_router(tonghuashun.router)

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    if frontend_dist.exists():
        app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")

    return app


app = create_app()
