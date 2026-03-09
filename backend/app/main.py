import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import engine, Base
from .routers import auth, subscription, stats, ai, payment, oauth

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(subscription.router, prefix="/api/subscription", tags=["subscription"])
app.include_router(stats.router, prefix="/api/stats", tags=["stats"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])
app.include_router(payment.router, prefix="/api/payment", tags=["payment"])
app.include_router(oauth.router, prefix="/api/oauth", tags=["oauth"])


@app.on_event("startup")
async def startup_event():
    if settings.secret_key == "change-this-in-production":
        raise RuntimeError("SECURITY ERROR: SECRET_KEY 仍是默认值，请在 .env 中配置强随机密钥")
    logger.info(f"Starting {settings.app_name}")
    logger.info(f"OpenAI configured: {bool(settings.openai_api_key)}")
    logger.info(f"Stripe configured: {bool(settings.stripe_secret_key)}")
    logger.info(f"Resend configured: {bool(settings.resend_api_key)}")
    logger.info(f"Google OAuth configured: {bool(settings.google_client_id)}")
    logger.info(f"GitHub OAuth configured: {bool(settings.github_client_id)}")


@app.get("/")
def root():
    return {"name": settings.app_name, "version": "3.1.0"}
