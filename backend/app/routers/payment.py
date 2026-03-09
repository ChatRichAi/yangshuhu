"""
Stripe payment router.
- POST /api/payment/create-checkout  - Create Stripe Checkout Session
- POST /api/payment/webhook          - Stripe webhook handler
- GET  /api/payment/portal           - Customer Portal link
"""

import logging

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import User
from ..services.email import send_subscription_notification
from .auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter()

stripe.api_key = settings.stripe_secret_key

# --- Price ID mapping ---

PRICE_MAP = {
    ("pro", "monthly"): "stripe_pro_monthly_price_id",
    ("pro", "yearly"): "stripe_pro_yearly_price_id",
    ("team", "monthly"): "stripe_team_monthly_price_id",
    ("team", "yearly"): "stripe_team_yearly_price_id",
}


def _get_price_id(plan: str, billing_period: str) -> str:
    attr = PRICE_MAP.get((plan, billing_period))
    if not attr:
        raise HTTPException(status_code=400, detail=f"无效的套餐组合: {plan}/{billing_period}")
    price_id = getattr(settings, attr, "")
    if not price_id:
        raise HTTPException(status_code=503, detail=f"支付价格未配置: {plan}/{billing_period}")
    return price_id


# --- Schemas ---


class CheckoutRequest(BaseModel):
    plan: str  # pro, team
    billing_period: str = "monthly"  # monthly, yearly


class CheckoutResponse(BaseModel):
    checkout_url: str


class PortalResponse(BaseModel):
    portal_url: str


# --- Endpoints ---


@router.post("/create-checkout", response_model=CheckoutResponse)
def create_checkout(
    req: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Stripe Checkout session for subscription."""
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="支付服务未配置")

    if req.plan not in ("pro", "team"):
        raise HTTPException(status_code=400, detail="无效套餐，可选: pro, team")

    if req.billing_period not in ("monthly", "yearly"):
        raise HTTPException(status_code=400, detail="无效计费周期，可选: monthly, yearly")

    price_id = _get_price_id(req.plan, req.billing_period)

    # Get or create Stripe customer
    customer_id = current_user.stripe_customer_id
    if not customer_id:
        customer = stripe.Customer.create(
            email=current_user.email,
            metadata={"user_id": str(current_user.id)},
        )
        current_user.stripe_customer_id = customer.id
        customer_id = customer.id
        db.commit()

    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{settings.frontend_url}/settings?payment=success",
        cancel_url=f"{settings.frontend_url}/pricing?payment=canceled",
        metadata={"user_id": str(current_user.id), "plan": req.plan},
    )

    return CheckoutResponse(checkout_url=session.url)


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle Stripe webhook events."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    event_type = event["type"]
    data = event["data"]["object"]

    if event_type == "checkout.session.completed":
        await _handle_checkout_completed(data, db)
    elif event_type == "customer.subscription.updated":
        await _handle_subscription_updated(data, db)
    elif event_type == "customer.subscription.deleted":
        await _handle_subscription_deleted(data, db)
    else:
        logger.info(f"[Webhook] Unhandled event: {event_type}")

    return {"status": "ok"}


@router.get("/portal", response_model=PortalResponse)
def get_portal(
    current_user: User = Depends(get_current_user),
):
    """Get Stripe Customer Portal URL for managing subscription."""
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="支付服务未配置")

    if not current_user.stripe_customer_id:
        raise HTTPException(status_code=400, detail="未找到支付账户，请先订阅")

    session = stripe.billing_portal.Session.create(
        customer=current_user.stripe_customer_id,
        return_url=f"{settings.frontend_url}/settings",
    )

    return PortalResponse(portal_url=session.url)


# --- Webhook handlers ---


async def _handle_checkout_completed(data: dict, db: Session):
    """Handle successful checkout - activate subscription."""
    customer_id = data.get("customer")
    subscription_id = data.get("subscription")
    plan = data.get("metadata", {}).get("plan", "pro")

    user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    if not user:
        logger.error(f"[Webhook] User not found for customer {customer_id}")
        return

    user.plan = plan
    user.stripe_subscription_id = subscription_id
    user.subscription_status = "active"
    db.commit()

    await send_subscription_notification(user.email, plan, "created")
    logger.info(f"[Webhook] User {user.id} subscribed to {plan}")


async def _handle_subscription_updated(data: dict, db: Session):
    """Handle subscription updates (plan change, renewal, etc.)."""
    subscription_id = data.get("id")
    status = data.get("status")

    user = db.query(User).filter(User.stripe_subscription_id == subscription_id).first()
    if not user:
        logger.error(f"[Webhook] User not found for subscription {subscription_id}")
        return

    user.subscription_status = status

    # If subscription becomes active again
    if status == "active":
        # Try to determine plan from price
        items = data.get("items", {}).get("data", [])
        if items:
            price_id = items[0].get("price", {}).get("id", "")
            # Match price ID back to plan
            for (plan, _period), attr in PRICE_MAP.items():
                if getattr(settings, attr, "") == price_id:
                    user.plan = plan
                    break

    # If past due or canceled
    if status in ("past_due", "canceled", "unpaid"):
        user.subscription_status = status

    db.commit()
    await send_subscription_notification(user.email, user.plan, "updated")
    logger.info(f"[Webhook] Subscription {subscription_id} updated: {status}")


async def _handle_subscription_deleted(data: dict, db: Session):
    """Handle subscription cancellation."""
    subscription_id = data.get("id")

    user = db.query(User).filter(User.stripe_subscription_id == subscription_id).first()
    if not user:
        logger.error(f"[Webhook] User not found for subscription {subscription_id}")
        return

    user.plan = "free"
    user.subscription_status = "canceled"
    user.stripe_subscription_id = None
    db.commit()

    await send_subscription_notification(user.email, "free", "canceled")
    logger.info(f"[Webhook] User {user.id} subscription canceled")
