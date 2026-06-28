def test_team_pool_and_strategy_templates(client, authorized_headers):
    team = client.post("/api/teams", json={"name": "Short Term Desk"}, headers=authorized_headers)
    assert team.status_code == 201

    invite = client.post(f"/api/teams/{team.json()['id']}/invites", headers=authorized_headers)
    assert invite.status_code == 201
    assert invite.json()["invite_code"]

    pool = client.post("/api/stock-pools", json={
        "name": "今日短线池",
        "scope": "team",
        "team_id": team.json()["id"],
        "symbols": ["600519", "000001", "300750"],
    }, headers=authorized_headers)
    assert pool.status_code == 201
    assert len(pool.json()["symbols"]) == 3

    templates = client.get("/api/strategies/templates", headers=authorized_headers)
    assert templates.status_code == 200
    keys = {item["key"] for item in templates.json()}
    assert {"strong_breakout", "pullback_rebound", "low_level_activity"} <= keys
