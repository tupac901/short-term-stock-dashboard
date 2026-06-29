from dataclasses import dataclass
from typing import Any


class TonghuashunSyncError(RuntimeError):
    pass


@dataclass(frozen=True)
class TonghuashunStock:
    symbol: str
    market: str | None = None
    name: str | None = None


def normalize_ths_symbol(raw: Any) -> str | None:
    text = str(raw or "").upper()
    digits = "".join(char for char in text if char.isdigit())
    if len(digits) < 6:
        return None
    return digits[-6:]


def extract_symbol_from_item(item: Any) -> TonghuashunStock | None:
    code = (
        getattr(item, "code", None)
        or getattr(item, "symbol", None)
        or getattr(item, "stock_code", None)
        or getattr(item, "C", None)
    )
    symbol = normalize_ths_symbol(code)
    if symbol is None and isinstance(item, dict):
        symbol = normalize_ths_symbol(
            item.get("code") or item.get("symbol") or item.get("stock_code") or item.get("C")
        )
    if symbol is None:
        symbol = normalize_ths_symbol(item)
    if symbol is None:
        return None

    market = getattr(item, "market", None) or getattr(item, "market_code", None)
    name = getattr(item, "name", None) or getattr(item, "stock_name", None)
    if isinstance(item, dict):
        market = market or item.get("market") or item.get("market_code") or item.get("M")
        name = name or item.get("name") or item.get("stock_name") or item.get("N")
    return TonghuashunStock(symbol=symbol, market=str(market) if market else None, name=str(name) if name else None)


def fetch_tonghuashun_self_stocks(
    *,
    username: str | None = None,
    password: str | None = None,
    cookies: str | None = None,
) -> list[TonghuashunStock]:
    if not cookies and not (username and password):
        raise TonghuashunSyncError("同花顺同步需要账号密码或 Cookie。")

    try:
        from service import PortfolioManager
    except Exception as exc:  # pragma: no cover - dependency/import environment
        raise TonghuashunSyncError("同花顺同步依赖未安装或加载失败。") from exc

    try:
        with PortfolioManager(
            username=username or None,
            password=password or None,
            cookies=cookies or None,
            enable_cache=False,
        ) as portfolio:
            group = portfolio.get_self_stocks()
    except Exception as exc:  # pragma: no cover - external service
        raise TonghuashunSyncError(f"同花顺同步失败：{exc}") from exc

    items = getattr(group, "items", group)
    stocks = [stock for item in items if (stock := extract_symbol_from_item(item)) is not None]
    unique: dict[str, TonghuashunStock] = {}
    for stock in stocks:
        unique[stock.symbol] = stock
    return list(unique.values())
