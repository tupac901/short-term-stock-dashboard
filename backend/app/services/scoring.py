from dataclasses import dataclass

from app.models import StrategyVersion
from app.services.data_sources.base import MarketSnapshot


@dataclass(frozen=True)
class ScoreResult:
    symbol: str
    name: str
    total_score: float
    technical_score: float
    capital_score: float
    fundamental_score: float
    risk_penalty: float
    reasons: list[str]
    risks: list[str]
    close: float
    amount: float


def clamp(value: float, low: float = 0, high: float = 100) -> float:
    return max(low, min(high, value))


def calculate_score(snapshot: MarketSnapshot, strategy: StrategyVersion) -> ScoreResult:
    trend = clamp(50 + snapshot.pct_change_20d * 2.2 + snapshot.pct_change_5d * 2.8)
    volume_signal = clamp(35 + snapshot.volume_ratio * 25 + snapshot.turnover * 5)
    breakout_bonus = 10 if snapshot.pct_change_5d > 5 and snapshot.volume_ratio > 1.2 else 0
    technical = clamp((trend * 0.72) + (volume_signal * 0.28) + breakout_bonus)

    amount_score = clamp(snapshot.amount / 100_000_000 * 4)
    turnover_score = clamp(snapshot.turnover * 16)
    capital = clamp(amount_score * 0.58 + turnover_score * 0.22 + snapshot.volume_ratio * 12)

    fundamental = 70
    risks: list[str] = []
    if snapshot.pe is not None and snapshot.pe > 60:
        fundamental -= 20
        risks.append("估值偏高")
    if snapshot.pb is not None and snapshot.pb > 8:
        fundamental -= 12
        risks.append("市净率偏高")

    risk = 0.0
    if snapshot.pct_change_20d > 25:
        risk += 20
        risks.append("短期涨幅过大")
    if snapshot.pct_change_5d < -6:
        risk += 14
        risks.append("短期跌幅较大")
    if snapshot.amount < 500_000_000:
        risk += 18
        risks.append("成交额不足")
    if snapshot.volume_ratio > 2.2 and snapshot.pct_change_5d < 0:
        risk += 12
        risks.append("异常放量后回落")

    weights_sum = (
        strategy.technical_weight
        + strategy.capital_weight
        + strategy.fundamental_weight
        + strategy.risk_weight
    ) or 100
    total = (
        technical * strategy.technical_weight
        + capital * strategy.capital_weight
        + fundamental * strategy.fundamental_weight
        - risk * strategy.risk_weight
    ) / weights_sum
    total = clamp(total)

    reasons = []
    if snapshot.pct_change_20d > 8:
        reasons.append("20日趋势较强")
    if snapshot.pct_change_5d > 4:
        reasons.append("短线动量活跃")
    if snapshot.volume_ratio > 1.3:
        reasons.append("量比放大")
    if snapshot.amount > 2_000_000_000:
        reasons.append("成交额活跃")
    if not reasons:
        reasons.append("综合指标稳定")

    return ScoreResult(
        symbol=snapshot.symbol,
        name=snapshot.name,
        total_score=round(total, 2),
        technical_score=round(technical, 2),
        capital_score=round(capital, 2),
        fundamental_score=round(fundamental, 2),
        risk_penalty=round(risk, 2),
        reasons=reasons,
        risks=risks or ["暂无明显短线风险"],
        close=snapshot.close,
        amount=snapshot.amount,
    )
