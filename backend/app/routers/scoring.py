import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlmodel import Session, select

from app.db import get_session
from app.models import ScoreRun, StockPool, StockPoolItem, StockScoreSnapshot, StrategyVersion, User
from app.routers.auth import get_current_user
from app.schemas import ScoreRunCreate, ScoreRunRead, StockScoreRead
from app.services.data_sources.sample import SampleMarketDataSource
from app.services.scoring import calculate_score


router = APIRouter(prefix="/api/scoring", tags=["scoring"])


def serialize_score(row: StockScoreSnapshot) -> StockScoreRead:
    return StockScoreRead(
        symbol=row.symbol,
        name=row.name,
        total_score=row.total_score,
        technical_score=row.technical_score,
        capital_score=row.capital_score,
        fundamental_score=row.fundamental_score,
        risk_penalty=row.risk_penalty,
        reasons=[item for item in row.reasons.split("|") if item],
        risks=[item for item in row.risks.split("|") if item],
        close=row.close,
        amount=row.amount,
    )


@router.post("/runs", response_model=ScoreRunRead, status_code=status.HTTP_201_CREATED)
def create_score_run(
    payload: ScoreRunCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ScoreRunRead:
    pool = session.get(StockPool, payload.stock_pool_id)
    strategy = session.get(StrategyVersion, payload.strategy_version_id)
    if pool is None or pool.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Stock pool not found")
    if strategy is None:
        raise HTTPException(status_code=404, detail="Strategy version not found")

    run = ScoreRun(stock_pool_id=pool.id, strategy_version_id=strategy.id, owner_id=user.id)
    session.add(run)
    session.commit()
    session.refresh(run)

    symbols = [
        item.symbol
        for item in session.exec(select(StockPoolItem).where(StockPoolItem.stock_pool_id == pool.id)).all()
    ]
    snapshots = SampleMarketDataSource().get_snapshots(symbols)
    for snapshot in snapshots:
        result = calculate_score(snapshot, strategy)
        session.add(StockScoreSnapshot(
            score_run_id=run.id,
            symbol=result.symbol,
            name=result.name,
            total_score=result.total_score,
            technical_score=result.technical_score,
            capital_score=result.capital_score,
            fundamental_score=result.fundamental_score,
            risk_penalty=result.risk_penalty,
            reasons="|".join(result.reasons),
            risks="|".join(result.risks),
            close=result.close,
            amount=result.amount,
        ))
    session.commit()
    return get_score_run(run.id, user, session)


@router.get("/runs/{run_id}", response_model=ScoreRunRead)
def get_score_run(
    run_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ScoreRunRead:
    run = session.get(ScoreRun, run_id)
    if run is None or run.owner_id != user.id:
        raise HTTPException(status_code=404, detail="Score run not found")
    rows = session.exec(
        select(StockScoreSnapshot).where(StockScoreSnapshot.score_run_id == run.id)
    ).all()
    scores = sorted((serialize_score(row) for row in rows), key=lambda item: item.total_score, reverse=True)
    return ScoreRunRead(
        id=run.id,
        stock_pool_id=run.stock_pool_id,
        strategy_version_id=run.strategy_version_id,
        status=run.status,
        scores=scores,
    )


@router.get("/runs/{run_id}/export.csv")
def export_score_run(
    run_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Response:
    detail = get_score_run(run_id, user, session)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "score_run_id",
        "strategy_version_id",
        "symbol",
        "name",
        "total_score",
        "technical_score",
        "capital_score",
        "fundamental_score",
        "risk_penalty",
        "reasons",
        "risks",
    ])
    for score in detail.scores:
        writer.writerow([
            detail.id,
            detail.strategy_version_id,
            score.symbol,
            score.name,
            score.total_score,
            score.technical_score,
            score.capital_score,
            score.fundamental_score,
            score.risk_penalty,
            ";".join(score.reasons),
            ";".join(score.risks),
        ])
    return Response(output.getvalue(), media_type="text/csv; charset=utf-8")
