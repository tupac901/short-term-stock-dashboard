import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    from app.core.config import get_settings

    get_settings.cache_clear()
    import app.db as db

    db.engine = db.make_engine()
    from app.main import create_app

    return TestClient(create_app())


@pytest.fixture
def authorized_headers(client: TestClient):
    email = "demo@example.com"
    client.post("/api/auth/register", json={
        "email": email,
        "password": "StrongPass123",
        "name": "Demo User",
    })
    token = client.post("/api/auth/login", json={
        "email": email,
        "password": "StrongPass123",
    }).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def seeded_pool_and_strategy(client: TestClient, authorized_headers):
    pool = client.post("/api/stock-pools", json={
        "name": "短线池",
        "scope": "personal",
        "symbols": ["600519", "000001", "300750"],
    }, headers=authorized_headers).json()
    template = client.get("/api/strategies/templates", headers=authorized_headers).json()[0]
    strategy = client.post("/api/strategies", json={
        "name": "强势突破",
        "template_key": template["key"],
        "weights": template["weights"],
    }, headers=authorized_headers).json()
    client.post("/api/scoring/runs", json={
        "stock_pool_id": pool["id"],
        "strategy_version_id": strategy["current_version_id"],
    }, headers=authorized_headers)
    return pool["id"], strategy["current_version_id"]
