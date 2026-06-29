from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: str


class UserRead(BaseModel):
    id: int
    email: str
    name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TeamCreate(BaseModel):
    name: str


class TeamRead(BaseModel):
    id: int
    name: str
    owner_id: int


class InviteRead(BaseModel):
    id: int
    team_id: int
    invite_code: str


class StockPoolCreate(BaseModel):
    name: str
    scope: str = "personal"
    team_id: int | None = None
    symbols: list[str]


class StockPoolRead(BaseModel):
    id: int
    name: str
    scope: str
    team_id: int | None
    symbols: list[str]


class TonghuashunSyncRequest(BaseModel):
    username: str | None = None
    password: str | None = None
    cookies: str | None = None
    pool_name: str = "同花顺APP自选同步"


class TonghuashunSyncResponse(BaseModel):
    stock_pool: StockPoolRead
    symbols: list[str]
    count: int
    source: str = "tonghuashun"


class StrategyWeights(BaseModel):
    technical: float = 45
    capital: float = 35
    risk: float = 15
    fundamental: float = 5


class StrategyTemplate(BaseModel):
    key: str
    name: str
    description: str
    weights: StrategyWeights


class StrategyCreate(BaseModel):
    name: str
    template_key: str
    weights: StrategyWeights
    team_id: int | None = None


class StrategyRead(BaseModel):
    id: int
    name: str
    template_key: str
    current_version_id: int
    weights: StrategyWeights


class ScoreRunCreate(BaseModel):
    stock_pool_id: int
    strategy_version_id: int


class StockScoreRead(BaseModel):
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


class ScoreRunRead(BaseModel):
    id: int
    stock_pool_id: int
    strategy_version_id: int
    status: str
    scores: list[StockScoreRead] = []


class AlertCreate(BaseModel):
    stock_pool_id: int
    symbol: str
    metric: str
    operator: str
    threshold: float


class AlertRead(BaseModel):
    id: int
    stock_pool_id: int
    symbol: str
    metric: str
    operator: str
    threshold: float
    active: bool


class AlertEventRead(BaseModel):
    id: int
    symbol: str
    message: str


class BacktestCreate(BaseModel):
    stock_pool_id: int
    strategy_version_id: int
    start_date: str
    end_date: str
    rebalance_frequency: str = "weekly"
    max_positions: int = 5
    fee_rate: float = 0.001


class BacktestRead(BaseModel):
    id: int
    total_return: float
    max_drawdown: float
    win_rate: float
    trade_count: int
