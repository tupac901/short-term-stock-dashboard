from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.db import get_session
from app.models import BacktestRun, BacktestTrade, StockPool, StockPoolItem, User
from app.routers.auth import get_current_user
from app.schemas import BacktestCreate, BacktestRead
from app.services.backtesting import run_daily_backtest


router = APIRouter(prefix="/api/backtests", tags=["backtests"])


@router.post("", response_model=BacktestRead, status_code=status.HTTP_201_CREATED)
def create_backtest(
    payload: BacktestCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> BacktestRun:
    pool = session.get(StockPool, payload.stock_pool_id)
    if pool is None or pool.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Stock pool not found")
    symbols = [
        item.symbol
        for item in session.exec(select(StockPoolItem).where(StockPoolItem.stock_pool_id == pool.id)).all()
    ]
    summary = run_daily_backtest(
        symbols,
        payload.start_date,
        payload.end_date,
        payload.max_positions,
        payload.fee_rate,
    )
    run = BacktestRun(
        owner_id=user.id,
        stock_pool_id=payload.stock_pool_id,
        strategy_version_id=payload.strategy_version_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        rebalance_frequency=payload.rebalance_frequency,
        max_positions=payload.max_positions,
        fee_rate=payload.fee_rate,
        total_return=summary.total_return,
        max_drawdown=summary.max_drawdown,
        win_rate=summary.win_rate,
        trade_count=summary.trade_count,
    )
    session.add(run)
    session.commit()
    session.refresh(run)
    for trade in summary.trades:
        session.add(BacktestTrade(backtest_run_id=run.id, **trade))
    session.commit()
    return run


@router.get("/{run_id}", response_model=BacktestRead)
def get_backtest(
    run_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> BacktestRun:
    run = session.get(BacktestRun, run_id)
    if run is None or run.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Backtest not found")
    return run
