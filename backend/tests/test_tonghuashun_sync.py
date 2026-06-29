from types import SimpleNamespace

from app.services.tonghuashun import extract_symbol_from_item, normalize_ths_symbol


def test_normalize_ths_symbol_handles_common_formats():
    assert normalize_ths_symbol("600519.SH") == "600519"
    assert normalize_ths_symbol("SZ000001") == "000001"
    assert normalize_ths_symbol("贵州茅台 600519") == "600519"


def test_extract_symbol_from_object_and_dict_items():
    assert extract_symbol_from_item(SimpleNamespace(code="300750", market="SZ")).symbol == "300750"
    assert extract_symbol_from_item({"C": "688981", "M": "SH"}).symbol == "688981"
