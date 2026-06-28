import hashlib

from app.services.data_sources.base import MarketSnapshot


SAMPLE_DATA = {
    "600519": MarketSnapshot("600519", "贵州茅台", 1518.5, 26_000_000, 3_950_000_000, 0.42, 2.1, 5.3, 1.15, 26.4, 8.2),
    "000001": MarketSnapshot("000001", "平安银行", 11.8, 184_000_000, 2_180_000_000, 0.95, -1.2, 1.6, 0.88, 4.9, 0.55),
    "300750": MarketSnapshot("300750", "宁德时代", 214.3, 81_000_000, 17_420_000_000, 1.82, 7.6, 18.2, 1.92, 21.8, 4.8),
    "002594": MarketSnapshot("002594", "比亚迪", 259.4, 63_000_000, 16_340_000_000, 1.41, 4.9, 12.7, 1.48, 24.1, 5.3),
    "601318": MarketSnapshot("601318", "中国平安", 43.6, 112_000_000, 4_890_000_000, 0.61, 0.8, -2.5, 0.96, 7.1, 0.92),
}


class SampleMarketDataSource:
    def get_snapshots(self, symbols: list[str]) -> list[MarketSnapshot]:
        return [SAMPLE_DATA.get(symbol, generated_snapshot(symbol)) for symbol in symbols]


def generated_snapshot(symbol: str) -> MarketSnapshot:
    digest = hashlib.sha256(symbol.encode("utf-8")).hexdigest()
    seed = int(digest[:8], 16)
    close = 8 + seed % 180
    pct5 = ((seed // 13) % 1800) / 100 - 9
    pct20 = ((seed // 29) % 3200) / 100 - 16
    volume_ratio = 0.6 + ((seed // 41) % 180) / 100
    turnover = 0.3 + ((seed // 59) % 420) / 100
    amount = (200_000_000 + (seed % 80) * 60_000_000)
    return MarketSnapshot(
        symbol=symbol,
        name=f"样例{symbol}",
        close=round(float(close), 2),
        volume=10_000_000 + seed % 250_000_000,
        amount=float(amount),
        turnover=round(turnover, 2),
        pct_change_5d=round(pct5, 2),
        pct_change_20d=round(pct20, 2),
        volume_ratio=round(volume_ratio, 2),
        pe=round(8 + (seed % 3500) / 100, 2),
        pb=round(0.6 + (seed % 600) / 100, 2),
    )
