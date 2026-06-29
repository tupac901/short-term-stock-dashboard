from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from app.db import get_session
from app.models import StockPool, StockPoolItem, User
from app.routers.auth import get_current_user
from app.routers.stock_pools import read_pool
from app.schemas import TonghuashunSyncRequest, TonghuashunSyncResponse
from app.services.tonghuashun import TonghuashunSyncError, fetch_tonghuashun_self_stocks


router = APIRouter(prefix="/api/integrations/tonghuashun", tags=["tonghuashun"])


@router.post("/sync", response_model=TonghuashunSyncResponse, status_code=status.HTTP_201_CREATED)
def sync_tonghuashun_watchlist(
    payload: TonghuashunSyncRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> TonghuashunSyncResponse:
    try:
        stocks = fetch_tonghuashun_self_stocks(
            username=payload.username,
            password=payload.password,
            cookies=payload.cookies,
        )
    except TonghuashunSyncError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    symbols = [stock.symbol for stock in stocks]
    if not symbols:
        raise HTTPException(status_code=400, detail="同花顺自选股为空，未同步到股票池。")

    pool = StockPool(name=payload.pool_name, scope="personal", owner_id=user.id, team_id=None)
    session.add(pool)
    session.commit()
    session.refresh(pool)

    for symbol in symbols:
        session.add(StockPoolItem(stock_pool_id=pool.id, symbol=symbol))
    session.commit()

    return TonghuashunSyncResponse(
        stock_pool=read_pool(pool, session),
        symbols=symbols,
        count=len(symbols),
    )
