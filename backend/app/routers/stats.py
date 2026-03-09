from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, TaskStats, TaskLog
from .auth import get_current_user

router = APIRouter()


class StatUpdate(BaseModel):
    action: str  # browse, like, collect, comment, follow
    detail: str | None = None


@router.post("/record")
def record_stat(stat: StatUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    today = datetime.utcnow().strftime("%Y-%m-%d")

    # Get or create today's stats
    daily = db.query(TaskStats).filter(
        TaskStats.user_id == current_user.id,
        TaskStats.date == today,
    ).first()

    if not daily:
        daily = TaskStats(user_id=current_user.id, date=today)
        db.add(daily)

    # Increment counter
    field_map = {
        "browse": "browse_count",
        "like": "like_count",
        "collect": "collect_count",
        "comment": "comment_count",
        "follow": "follow_count",
    }

    field = field_map.get(stat.action)
    if field:
        setattr(daily, field, getattr(daily, field) + 1)

    # Add log entry
    log = TaskLog(
        user_id=current_user.id,
        action=stat.action,
        detail=stat.detail,
    )
    db.add(log)
    db.commit()

    return {"status": "ok"}


@router.get("/summary")
def get_summary(
    days: int = Query(default=7, le=90),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    since = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
    stats = db.query(TaskStats).filter(
        TaskStats.user_id == current_user.id,
        TaskStats.date >= since,
    ).order_by(TaskStats.date.desc()).all()

    total = {"browse": 0, "like": 0, "collect": 0, "comment": 0, "follow": 0}
    daily = []

    for s in stats:
        total["browse"] += s.browse_count
        total["like"] += s.like_count
        total["collect"] += s.collect_count
        total["comment"] += s.comment_count
        total["follow"] += s.follow_count
        daily.append({
            "date": s.date,
            "browse": s.browse_count,
            "like": s.like_count,
            "collect": s.collect_count,
            "comment": s.comment_count,
            "follow": s.follow_count,
        })

    return {"total": total, "daily": daily}


@router.get("/logs")
def get_logs(
    limit: int = Query(default=50, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    logs = db.query(TaskLog).filter(
        TaskLog.user_id == current_user.id,
    ).order_by(TaskLog.created_at.desc()).limit(limit).all()

    return [
        {
            "action": log.action,
            "detail": log.detail,
            "time": log.created_at.isoformat(),
        }
        for log in logs
    ]
