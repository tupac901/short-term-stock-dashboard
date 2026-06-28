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
