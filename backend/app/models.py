from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    name: str
    password_hash: str
    created_at: datetime = Field(default_factory=utc_now)


class Team(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    owner_id: int = Field(foreign_key="user.id", index=True)
    created_at: datetime = Field(default_factory=utc_now)


class TeamMember(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    team_id: int = Field(foreign_key="team.id", index=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    role: str = "member"
    created_at: datetime = Field(default_factory=utc_now)


class TeamInvite(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    team_id: int = Field(foreign_key="team.id", index=True)
    invite_code: str = Field(index=True, unique=True)
    created_by_id: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=utc_now)


class StockPool(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    scope: str = Field(default="personal", index=True)
    owner_id: int = Field(foreign_key="user.id", index=True)
    team_id: int | None = Field(default=None, foreign_key="team.id", index=True)
    created_at: datetime = Field(default_factory=utc_now)


class StockPoolItem(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    stock_pool_id: int = Field(foreign_key="stockpool.id", index=True)
    symbol: str = Field(index=True)
    created_at: datetime = Field(default_factory=utc_now)


class Strategy(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    template_key: str
    owner_id: int = Field(foreign_key="user.id", index=True)
    team_id: int | None = Field(default=None, foreign_key="team.id", index=True)
    current_version_id: int | None = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=utc_now)


class StrategyVersion(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    strategy_id: int = Field(foreign_key="strategy.id", index=True)
    version: int = 1
    technical_weight: float = 45
    capital_weight: float = 35
    risk_weight: float = 15
    fundamental_weight: float = 5
    created_at: datetime = Field(default_factory=utc_now)


class ScoreRun(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    stock_pool_id: int = Field(foreign_key="stockpool.id", index=True)
    strategy_version_id: int = Field(foreign_key="strategyversion.id", index=True)
    owner_id: int = Field(foreign_key="user.id", index=True)
    status: str = "success"
    created_at: datetime = Field(default_factory=utc_now)


class StockScoreSnapshot(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    score_run_id: int = Field(foreign_key="scorerun.id", index=True)
    symbol: str = Field(index=True)
    name: str
    total_score: float
    technical_score: float
    capital_score: float
    fundamental_score: float
    risk_penalty: float
    reasons: str
    risks: str
    close: float
    amount: float
    created_at: datetime = Field(default_factory=utc_now)


class WatchlistAlert(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="user.id", index=True)
    stock_pool_id: int = Field(foreign_key="stockpool.id", index=True)
    symbol: str
    metric: str
    operator: str
    threshold: float
    active: bool = True
    created_at: datetime = Field(default_factory=utc_now)


class AlertEvent(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    alert_id: int = Field(foreign_key="watchlistalert.id", index=True)
    owner_id: int = Field(foreign_key="user.id", index=True)
    symbol: str
    message: str
    created_at: datetime = Field(default_factory=utc_now)


class BacktestRun(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    owner_id: int = Field(foreign_key="user.id", index=True)
    stock_pool_id: int = Field(foreign_key="stockpool.id", index=True)
    strategy_version_id: int = Field(foreign_key="strategyversion.id", index=True)
    start_date: str
    end_date: str
    rebalance_frequency: str
    max_positions: int
    fee_rate: float
    total_return: float
    max_drawdown: float
    win_rate: float
    trade_count: int
    created_at: datetime = Field(default_factory=utc_now)


class BacktestTrade(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    backtest_run_id: int = Field(foreign_key="backtestrun.id", index=True)
    symbol: str
    side: str
    trade_date: str
    price: float
    quantity: float
