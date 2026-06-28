from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class MarketSnapshot:
    symbol: str
    name: str
    close: float
    volume: int
    amount: float
    turnover: float
    pct_change_5d: float
    pct_change_20d: float
    volume_ratio: float
    pe: float | None
    pb: float | None


class MarketDataSource(Protocol):
    def get_snapshots(self, symbols: list[str]) -> list[MarketSnapshot]:
        """Return normalized market snapshots for the requested symbols."""
