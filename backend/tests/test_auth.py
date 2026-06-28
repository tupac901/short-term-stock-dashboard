from fastapi.testclient import TestClient

from app.main import create_app


def test_register_login_and_me(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    from app.core.config import get_settings

    get_settings.cache_clear()
    import app.db as db

    db.engine = db.make_engine()
    client = TestClient(create_app())

    register = client.post("/api/auth/register", json={
        "email": "demo@example.com",
        "password": "StrongPass123",
        "name": "Demo User",
    })
    assert register.status_code == 201
    assert register.json()["email"] == "demo@example.com"

    login = client.post("/api/auth/login", json={
        "email": "demo@example.com",
        "password": "StrongPass123",
    })
    assert login.status_code == 200
    token = login.json()["access_token"]

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["name"] == "Demo User"
