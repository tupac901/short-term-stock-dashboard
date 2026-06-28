from fastapi import APIRouter, Depends, status
from sqlmodel import Session, select

from app.db import get_session
from app.models import AlertEvent, StockPoolItem, StockScoreSnapshot, User, WatchlistAlert
from app.routers.auth import get_current_user
from app.schemas import AlertCreate, AlertEventRead, AlertRead
from app.services.alerts import is_triggered
from app.services.data_sources.sample import SampleMarketDataSource


router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.post("", response_model=AlertRead, status_code=status.HTTP_201_CREATED)
def create_alert(
    payload: AlertCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> WatchlistAlert:
    alert = WatchlistAlert(owner_id=user.id, **payload.model_dump())
    session.add(alert)
    session.commit()
    session.refresh(alert)
    return alert


@router.post("/evaluate")
def evaluate_alerts(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    alerts = session.exec(select(WatchlistAlert).where(WatchlistAlert.owner_id == user.id, WatchlistAlert.active)).all()
    created = 0
    data_source = SampleMarketDataSource()
    for alert in alerts:
        value = None
        if alert.metric == "total_score":
            latest = session.exec(
                select(StockScoreSnapshot)
                .where(StockScoreSnapshot.symbol == alert.symbol)
                .order_by(StockScoreSnapshot.id.desc())
            ).first()
            value = latest.total_score if latest else None
        else:
            snapshot = data_source.get_snapshots([alert.symbol])[0]
            value = getattr(snapshot, alert.metric, None)
        if value is not None and is_triggered(float(value), alert.operator, alert.threshold):
            exists = session.exec(
                select(AlertEvent).where(AlertEvent.alert_id == alert.id, AlertEvent.symbol == alert.symbol)
            ).first()
            if exists is None:
                session.add(AlertEvent(
                    alert_id=alert.id,
                    owner_id=user.id,
                    symbol=alert.symbol,
                    message=f"{alert.symbol} {alert.metric} {alert.operator} {alert.threshold}",
                ))
                created += 1
    session.commit()
    return {"created": created}


@router.get("/events", response_model=list[AlertEventRead])
def list_events(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[AlertEvent]:
    return session.exec(select(AlertEvent).where(AlertEvent.owner_id == user.id).order_by(AlertEvent.id.desc())).all()
