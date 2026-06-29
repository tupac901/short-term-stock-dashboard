from types import SimpleNamespace

from app.services.tonghuashun import TonghuashunStock
from app.services.tonghuashun import extract_symbol_from_item, normalize_ths_symbol


def test_normalize_ths_symbol_handles_common_formats():
    assert normalize_ths_symbol("600519.SH") == "600519"
    assert normalize_ths_symbol("SZ000001") == "000001"
    assert normalize_ths_symbol("贵州茅台 600519") == "600519"


def test_extract_symbol_from_object_and_dict_items():
    assert extract_symbol_from_item(SimpleNamespace(code="300750", market="SZ")).symbol == "300750"
    assert extract_symbol_from_item({"C": "688981", "M": "SH"}).symbol == "688981"


def test_sync_endpoint_creates_pool_from_tonghuashun(client, authorized_headers, monkeypatch):
    def fake_fetch_tonghuashun_self_stocks(**_kwargs):
        return [
            TonghuashunStock(symbol="600519"),
            TonghuashunStock(symbol="300750"),
        ]

    monkeypatch.setattr(
        "app.routers.tonghuashun.fetch_tonghuashun_self_stocks",
        fake_fetch_tonghuashun_self_stocks,
    )
    response = client.post(
        "/api/integrations/tonghuashun/sync",
        json={"username": "demo", "password": "secret123"},
        headers=authorized_headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["count"] == 2
    assert body["symbols"] == ["600519", "300750"]
    assert body["stock_pool"]["symbols"] == ["600519", "300750"]
