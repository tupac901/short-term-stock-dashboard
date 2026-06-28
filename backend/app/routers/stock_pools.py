from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.db import get_session
from app.models import StockPool, StockPoolItem, TeamMember, User
from app.routers.auth import get_current_user
from app.schemas import StockPoolCreate, StockPoolRead


router = APIRouter(prefix="/api/stock-pools", tags=["stock-pools"])


def normalize_symbol(symbol: str) -> str:
    return symbol.strip().upper()


def assert_team_access(team_id: int, user_id: int, session: Session) -> None:
    member = session.exec(
        select(TeamMember).where(TeamMember.team_id == team_id, TeamMember.user_id == user_id)
    ).first()
    if member is None:
        raise HTTPException(status_code=403, detail="No team access")


def read_pool(pool: StockPool, session: Session) -> StockPoolRead:
    symbols = session.exec(
        select(StockPoolItem).where(StockPoolItem.stock_pool_id == pool.id)
    ).all()
    return StockPoolRead(
        id=pool.id,
        name=pool.name,
        scope=pool.scope,
        team_id=pool.team_id,
        symbols=[item.symbol for item in symbols],
    )


@router.post("", response_model=StockPoolRead, status_code=status.HTTP_201_CREATED)
def create_stock_pool(
    payload: StockPoolCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> StockPoolRead:
    if payload.scope not in {"personal", "team"}:
        raise HTTPException(status_code=400, detail="scope must be personal or team")
    if payload.scope == "team":
        if payload.team_id is None:
            raise HTTPException(status_code=400, detail="team_id is required")
        assert_team_access(payload.team_id, user.id, session)
    pool = StockPool(name=payload.name, scope=payload.scope, owner_id=user.id, team_id=payload.team_id)
    session.add(pool)
    session.commit()
    session.refresh(pool)
    for symbol in dict.fromkeys(normalize_symbol(item) for item in payload.symbols if item.strip()):
        session.add(StockPoolItem(stock_pool_id=pool.id, symbol=symbol))
    session.commit()
    return read_pool(pool, session)


@router.get("", response_model=list[StockPoolRead])
def list_stock_pools(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[StockPoolRead]:
    personal = session.exec(select(StockPool).where(StockPool.owner_id == user.id)).all()
    return [read_pool(pool, session) for pool in personal]
