# Stock Analysis Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first deployable MVP of a short-term stock analysis dashboard with users, teams, stock pools, strategy templates, scoring, exports, alerts, and daily backtests.

**Architecture:** Use a monorepo with a FastAPI backend and a React/Vite frontend. The backend owns auth, data, scoring, alerts, and backtests; the frontend consumes backend APIs only. Market data is accessed through a replaceable adapter with deterministic sample data as the first implementation, so the app works immediately and later can swap to real public data sources.

**Tech Stack:** Python 3.12, FastAPI, SQLModel/SQLite for MVP persistence, pytest, React, Vite, TypeScript, Vitest, Recharts.

## Global Constraints

- Product focus: short-term and swing trading research.
- First version must not implement automatic trading, broker order placement, real brokerage account connection, or paid subscriptions.
- Scoring defaults: technical 45%, capital/activity 35%, risk penalty 15%, fundamentals 5%.
- Strategy templates required: strong breakout, pullback rebound, low-level activity.
- Watch refresh target: configurable 1 to 5 minute polling, with no millisecond real-time claim.
- Backtest granularity: daily bars only; no minute-level matching.
- Data sources must use a unified adapter interface; scoring must not depend directly on one plugin or vendor API.
- Public Equity Investing is optional auxiliary data for fundamentals, valuation, industry comparison, and risk explanation only.

---

## File Structure

- `backend/app/main.py`: FastAPI app factory, router registration, CORS.
- `backend/app/core/config.py`: settings and constants.
- `backend/app/core/security.py`: password hashing and JWT helpers.
- `backend/app/db.py`: SQLModel engine, session dependency, database creation.
- `backend/app/models.py`: database models.
- `backend/app/schemas.py`: request and response schemas.
- `backend/app/routers/auth.py`: register, login, current user.
- `backend/app/routers/teams.py`: basic team creation and invitations.
- `backend/app/routers/stock_pools.py`: stock pool CRUD and stock item management.
- `backend/app/routers/strategies.py`: strategy templates and custom strategy versions.
- `backend/app/routers/scoring.py`: score run APIs and CSV export.
- `backend/app/routers/alerts.py`: alert configuration and events.
- `backend/app/routers/backtests.py`: daily backtest APIs.
- `backend/app/services/data_sources/base.py`: unified data source protocol.
- `backend/app/services/data_sources/sample.py`: deterministic sample A-share market data.
- `backend/app/services/scoring.py`: short-term scoring engine.
- `backend/app/services/backtesting.py`: daily backtest engine.
- `backend/app/services/alerts.py`: alert evaluation.
- `backend/tests/`: backend test suite.
- `frontend/src/api/client.ts`: typed API wrapper.
- `frontend/src/App.tsx`: app shell and routing.
- `frontend/src/pages/*.tsx`: dashboard pages.
- `frontend/src/components/*.tsx`: reusable UI pieces.
- `frontend/src/types.ts`: shared frontend types.
- `frontend/src/styles.css`: application styling.

---

### Task 1: Backend Foundation and Authentication

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/core/config.py`
- Create: `backend/app/core/security.py`
- Create: `backend/app/db.py`
- Create: `backend/app/models.py`
- Create: `backend/app/schemas.py`
- Create: `backend/app/routers/auth.py`
- Create: `backend/tests/test_auth.py`

**Interfaces:**
- Produces: `create_app() -> FastAPI`
- Produces: `get_session() -> Iterator[Session]`
- Produces: `POST /api/auth/register`
- Produces: `POST /api/auth/login`
- Produces: `GET /api/auth/me`

- [ ] **Step 1: Write failing auth tests**

```python
from fastapi.testclient import TestClient

from app.main import create_app


def test_register_login_and_me(tmp_path, monkeypatch):
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; python -m pytest tests/test_auth.py -v`

Expected: FAIL because backend files do not exist.

- [ ] **Step 3: Implement authentication foundation**

Create FastAPI app, SQLite database, `User` model, password hashing with `passlib[bcrypt]`, JWT creation with `python-jose`, and auth routes.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend; python -m pytest tests/test_auth.py -v`

Expected: PASS.

---

### Task 2: Teams, Stock Pools, and Strategy Templates

**Files:**
- Modify: `backend/app/models.py`
- Modify: `backend/app/schemas.py`
- Modify: `backend/app/main.py`
- Create: `backend/app/routers/teams.py`
- Create: `backend/app/routers/stock_pools.py`
- Create: `backend/app/routers/strategies.py`
- Create: `backend/tests/test_research_setup.py`

**Interfaces:**
- Consumes: authenticated user dependency from Task 1.
- Produces: `POST /api/teams`
- Produces: `POST /api/teams/{team_id}/invites`
- Produces: `POST /api/stock-pools`
- Produces: `GET /api/strategies/templates`
- Produces: `POST /api/strategies`

- [ ] **Step 1: Write failing research setup tests**

```python
def auth_headers(client):
    client.post("/api/auth/register", json={
        "email": "demo@example.com",
        "password": "StrongPass123",
        "name": "Demo User",
    })
    token = client.post("/api/auth/login", json={
        "email": "demo@example.com",
        "password": "StrongPass123",
    }).json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_team_pool_and_strategy_templates(client):
    headers = auth_headers(client)
    team = client.post("/api/teams", json={"name": "Short Term Desk"}, headers=headers)
    assert team.status_code == 201

    invite = client.post(f"/api/teams/{team.json()['id']}/invites", headers=headers)
    assert invite.status_code == 201
    assert invite.json()["invite_code"]

    pool = client.post("/api/stock-pools", json={
        "name": "今日短线池",
        "scope": "team",
        "team_id": team.json()["id"],
        "symbols": ["600519", "000001", "300750"],
    }, headers=headers)
    assert pool.status_code == 201
    assert len(pool.json()["symbols"]) == 3

    templates = client.get("/api/strategies/templates", headers=headers)
    assert templates.status_code == 200
    keys = {item["key"] for item in templates.json()}
    assert {"strong_breakout", "pullback_rebound", "low_level_activity"} <= keys
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; python -m pytest tests/test_research_setup.py -v`

Expected: FAIL because routes and models are missing.

- [ ] **Step 3: Implement teams, stock pools, and strategy templates**

Add models for `Team`, `TeamMember`, `TeamInvite`, `StockPool`, `StockPoolItem`, `Strategy`, and `StrategyVersion`. Add three default short-term strategy templates with weights `technical=45`, `capital=35`, `risk=15`, `fundamental=5`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend; python -m pytest tests/test_research_setup.py -v`

Expected: PASS.

---

### Task 3: Sample Data Adapter and Short-Term Scoring

**Files:**
- Create: `backend/app/services/data_sources/base.py`
- Create: `backend/app/services/data_sources/sample.py`
- Create: `backend/app/services/scoring.py`
- Create: `backend/app/routers/scoring.py`
- Modify: `backend/app/models.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_scoring.py`

**Interfaces:**
- Consumes: stock pools and strategy versions from Task 2.
- Produces: `MarketSnapshot(symbol: str, name: str, close: float, volume: int, amount: float, turnover: float, pct_change_5d: float, pct_change_20d: float, volume_ratio: float, pe: float | None, pb: float | None)`
- Produces: `calculate_score(snapshot, weights) -> ScoreResult`
- Produces: `POST /api/scoring/runs`
- Produces: `GET /api/scoring/runs/{run_id}`
- Produces: `GET /api/scoring/runs/{run_id}/export.csv`

- [ ] **Step 1: Write failing scoring tests**

```python
def test_score_run_produces_short_term_explanations(client, authorized_headers):
    pool = client.post("/api/stock-pools", json={
        "name": "短线池",
        "scope": "personal",
        "symbols": ["600519", "000001", "300750"],
    }, headers=authorized_headers).json()
    template = client.get("/api/strategies/templates", headers=authorized_headers).json()[0]
    strategy = client.post("/api/strategies", json={
        "name": "强势突破测试",
        "template_key": template["key"],
        "weights": template["weights"],
    }, headers=authorized_headers).json()

    run = client.post("/api/scoring/runs", json={
        "stock_pool_id": pool["id"],
        "strategy_version_id": strategy["current_version_id"],
    }, headers=authorized_headers)
    assert run.status_code == 201
    detail = client.get(f"/api/scoring/runs/{run.json()['id']}", headers=authorized_headers)
    assert detail.status_code == 200
    assert len(detail.json()["scores"]) == 3
    assert detail.json()["scores"][0]["total_score"] <= 100
    assert detail.json()["scores"][0]["reasons"]

    export = client.get(f"/api/scoring/runs/{run.json()['id']}/export.csv", headers=authorized_headers)
    assert export.status_code == 200
    assert "strategy_version_id" in export.text
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; python -m pytest tests/test_scoring.py -v`

Expected: FAIL because scoring service is missing.

- [ ] **Step 3: Implement deterministic scoring**

Use sample market data for known symbols and generated deterministic fallback data for unknown symbols. Calculate technical, capital, fundamental, and risk scores, then total score with default short-term weights. Save `ScoreRun` and `StockScoreSnapshot` rows.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend; python -m pytest tests/test_scoring.py -v`

Expected: PASS.

---

### Task 4: Alerts and Daily Backtests

**Files:**
- Create: `backend/app/services/alerts.py`
- Create: `backend/app/services/backtesting.py`
- Create: `backend/app/routers/alerts.py`
- Create: `backend/app/routers/backtests.py`
- Modify: `backend/app/models.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_alerts_backtests.py`

**Interfaces:**
- Consumes: score runs and stock pools from Task 3.
- Produces: `POST /api/alerts`
- Produces: `POST /api/alerts/evaluate`
- Produces: `GET /api/alerts/events`
- Produces: `POST /api/backtests`
- Produces: `GET /api/backtests/{run_id}`

- [ ] **Step 1: Write failing alerts and backtest tests**

```python
def test_alerts_and_backtest(client, authorized_headers, seeded_pool_and_strategy):
    pool_id, strategy_version_id = seeded_pool_and_strategy

    alert = client.post("/api/alerts", json={
        "stock_pool_id": pool_id,
        "symbol": "300750",
        "metric": "total_score",
        "operator": ">=",
        "threshold": 70,
    }, headers=authorized_headers)
    assert alert.status_code == 201

    evaluated = client.post("/api/alerts/evaluate", headers=authorized_headers)
    assert evaluated.status_code == 200

    events = client.get("/api/alerts/events", headers=authorized_headers)
    assert events.status_code == 200

    backtest = client.post("/api/backtests", json={
        "stock_pool_id": pool_id,
        "strategy_version_id": strategy_version_id,
        "start_date": "2026-01-01",
        "end_date": "2026-03-31",
        "rebalance_frequency": "weekly",
        "max_positions": 3,
        "fee_rate": 0.001,
    }, headers=authorized_headers)
    assert backtest.status_code == 201
    assert backtest.json()["max_drawdown"] <= 0
    assert backtest.json()["trade_count"] >= 1
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend; python -m pytest tests/test_alerts_backtests.py -v`

Expected: FAIL because alert and backtest routes are missing.

- [ ] **Step 3: Implement alerts and daily backtests**

Implement alert config, one-shot event creation, and a deterministic daily backtest using generated daily bars. Store summary metrics and trade details.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend; python -m pytest tests/test_alerts_backtests.py -v`

Expected: PASS.

---

### Task 5: Frontend MVP

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/types.ts`
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/pages/DashboardPage.tsx`
- Create: `frontend/src/pages/StockPoolsPage.tsx`
- Create: `frontend/src/pages/StrategiesPage.tsx`
- Create: `frontend/src/pages/ScoringPage.tsx`
- Create: `frontend/src/pages/BacktestsPage.tsx`
- Create: `frontend/src/styles.css`
- Create: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: backend APIs from Tasks 1-4.
- Produces: browser UI for login, dashboard, pools, strategies, scoring, alerts, and backtests.

- [ ] **Step 1: Write failing frontend smoke test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the short-term stock dashboard shell", () => {
    render(<App />);
    expect(screen.getByText("短线投研仪表盘")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend; npm test -- --run`

Expected: FAIL because frontend files do not exist.

- [ ] **Step 3: Implement React MVP**

Build a pragmatic dashboard UI with login, team/pool creation forms, strategy template selection, score run table, alert form, and backtest form. Use clear short-term trading language and restrained dashboard styling.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend; npm test -- --run`

Expected: PASS.

---

### Task 6: Local Run, Documentation, and Verification

**Files:**
- Create: `README.md`
- Create: `.gitignore`
- Create: `backend/.env.example`
- Create: `frontend/.env.example`

**Interfaces:**
- Consumes: completed backend and frontend.
- Produces: documented local development commands and verification status.

- [ ] **Step 1: Add setup docs**

Document:

```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
uvicorn app.main:create_app --factory --reload --port 8000

cd frontend
npm install
npm run dev
```

- [ ] **Step 2: Run backend tests**

Run: `cd backend; python -m pytest -v`

Expected: all backend tests PASS.

- [ ] **Step 3: Run frontend tests**

Run: `cd frontend; npm test -- --run`

Expected: all frontend tests PASS.

- [ ] **Step 4: Build frontend**

Run: `cd frontend; npm run build`

Expected: build succeeds.

- [ ] **Step 5: Start dev servers**

Run backend: `cd backend; uvicorn app.main:create_app --factory --reload --port 8000`

Run frontend: `cd frontend; npm run dev -- --host 127.0.0.1 --port 5173`

Expected: frontend available at `http://127.0.0.1:5173`.

---

## Self-Review

- Spec coverage: authentication, team basics, stock pools, strategies, short-term scoring, optional data source boundary, alerts, daily backtests, exports, and non-trading constraints are covered.
- Deliberate MVP gap: real public market API integration is abstracted behind the adapter and starts with deterministic sample data so the app works immediately. Replacing the adapter with AkShare/Tushare/Public Equity Investing is a follow-up task after credentials and availability are confirmed.
- Placeholder scan: no TODO/TBD placeholders remain.
- Type consistency: route names, entity names, and service names are consistent across tasks.
