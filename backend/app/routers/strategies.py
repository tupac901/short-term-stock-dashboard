from fastapi import APIRouter, Depends, status
from sqlmodel import Session

from app.db import get_session
from app.models import Strategy, StrategyVersion, User
from app.routers.auth import get_current_user
from app.schemas import StrategyCreate, StrategyRead, StrategyTemplate, StrategyWeights


router = APIRouter(prefix="/api/strategies", tags=["strategies"])


TEMPLATES = [
    StrategyTemplate(
        key="strong_breakout",
        name="强势突破",
        description="偏好放量突破、均线多头、成交额活跃的股票。",
        weights=StrategyWeights(technical=45, capital=35, risk=15, fundamental=5),
    ),
    StrategyTemplate(
        key="pullback_rebound",
        name="回踩反弹",
        description="偏好趋势仍在、短期回调到关键均线附近并出现企稳迹象的股票。",
        weights=StrategyWeights(technical=45, capital=30, risk=20, fundamental=5),
    ),
    StrategyTemplate(
        key="low_level_activity",
        name="低位异动",
        description="偏好近期成交额和换手明显放大、但短期涨幅尚未过大的股票。",
        weights=StrategyWeights(technical=35, capital=45, risk=15, fundamental=5),
    ),
]


@router.get("/templates", response_model=list[StrategyTemplate])
def templates() -> list[StrategyTemplate]:
    return TEMPLATES


@router.post("", response_model=StrategyRead, status_code=status.HTTP_201_CREATED)
def create_strategy(
    payload: StrategyCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> StrategyRead:
    strategy = Strategy(
        name=payload.name,
        template_key=payload.template_key,
        owner_id=user.id,
        team_id=payload.team_id,
    )
    session.add(strategy)
    session.commit()
    session.refresh(strategy)
    version = StrategyVersion(
        strategy_id=strategy.id,
        technical_weight=payload.weights.technical,
        capital_weight=payload.weights.capital,
        risk_weight=payload.weights.risk,
        fundamental_weight=payload.weights.fundamental,
    )
    session.add(version)
    session.commit()
    session.refresh(version)
    strategy.current_version_id = version.id
    session.add(strategy)
    session.commit()
    return StrategyRead(
        id=strategy.id,
        name=strategy.name,
        template_key=strategy.template_key,
        current_version_id=version.id,
        weights=payload.weights,
    )
