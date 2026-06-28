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
