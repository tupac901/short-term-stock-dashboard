import hashlib
from dataclasses import dataclass
from datetime import date, timedelta


@dataclass(frozen=True)
class BacktestSummary:
    total_return: float
    max_drawdown: float
    win_rate: float
    trade_count: int
    trades: list[dict]


def symbol_return(symbol: str, index: int) -> float:
    seed = int(hashlib.sha256(f"{symbol}-{index}".encode("utf-8")).hexdigest()[:8], 16)
    return ((seed % 500) - 210) / 10000


def run_daily_backtest(
    symbols: list[str],
    start_date: str,
    end_date: str,
    max_positions: int,
    fee_rate: float,
) -> BacktestSummary:
    start = date.fromisoformat(start_date)
    end = date.fromisoformat(end_date)
    days = max(1, (end - start).days)
    selected = symbols[: max(1, max_positions)]
    equity = 1.0
    peak = 1.0
    max_drawdown = 0.0
    wins = 0
    periods = 0
    trades = []
    current = start
    index = 0
    while current <= end:
        if current.weekday() < 5:
            daily = sum(symbol_return(symbol, index) for symbol in selected) / len(selected)
            if index % 5 == 0:
                daily -= fee_rate
                for symbol in selected:
                    trades.append({
                        "symbol": symbol,
                        "side": "rebalance",
                        "trade_date": current.isoformat(),
                        "price": round(10 + index + len(symbol), 2),
                        "quantity": 100,
                    })
            equity *= 1 + daily
            peak = max(peak, equity)
            max_drawdown = min(max_drawdown, (equity - peak) / peak)
            wins += 1 if daily > 0 else 0
            periods += 1
            index += 1
        current += timedelta(days=1)
    return BacktestSummary(
        total_return=round(equity - 1, 4),
        max_drawdown=round(max_drawdown, 4),
        win_rate=round(wins / periods if periods else 0, 4),
        trade_count=len(trades),
        trades=trades,
    )
