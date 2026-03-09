from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from .auth import get_current_user

router = APIRouter()


class PlanUpdate(BaseModel):
    plan: str


@router.get("/current")
def get_current_plan(current_user: User = Depends(get_current_user)):
    return {
        "plan": current_user.plan,
        "email": current_user.email,
    }


@router.post("/upgrade")
def upgrade_plan(plan_data: PlanUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    valid_plans = ["free", "pro", "team"]
    if plan_data.plan not in valid_plans:
        raise HTTPException(status_code=400, detail="Invalid plan")

    # Paid plans must be upgraded via Stripe checkout/webhook to prevent privilege escalation.
    if plan_data.plan in ("pro", "team"):
        raise HTTPException(
            status_code=403,
            detail="付费套餐升级请通过支付流程完成（/api/payment/create-checkout）",
        )

    current_user.plan = plan_data.plan
    db.commit()
    return {"plan": current_user.plan, "message": "套餐已更新"}


@router.post("/cancel")
def cancel_subscription(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.plan = "free"
    db.commit()
    return {"plan": "free", "message": "订阅已取消"}
