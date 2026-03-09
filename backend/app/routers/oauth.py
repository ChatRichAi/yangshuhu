"""
OAuth router - Google and GitHub OAuth2 callback handling.
"""

import secrets
from datetime import datetime, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import User
from .auth import create_access_token

router = APIRouter()


def _create_oauth_state(provider: str) -> str:
    payload = {
        "provider": provider,
        "nonce": secrets.token_urlsafe(8),
        "exp": datetime.utcnow() + timedelta(minutes=10),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def _verify_oauth_state(provider: str, state: str):
    try:
        payload = jwt.decode(state, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        raise HTTPException(status_code=400, detail="OAuth state 校验失败")
    if payload.get("provider") != provider:
        raise HTTPException(status_code=400, detail="OAuth state 校验失败")


# --- Google OAuth ---


@router.get("/google/url")
def google_auth_url():
    """Return the Google OAuth authorization URL."""
    if not settings.google_client_id:
        raise HTTPException(status_code=503, detail="Google OAuth 未配置")

    state = _create_oauth_state("google")

    url = (
        "https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={settings.google_client_id}"
        f"&redirect_uri={settings.google_redirect_uri}"
        "&response_type=code"
        "&scope=openid%20email%20profile"
        "&access_type=offline"
        f"&state={state}"
    )
    return {"url": url}


@router.get("/google/callback")
async def google_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
):
    """Handle Google OAuth callback, create/login user, return JWT."""
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=503, detail="Google OAuth 未配置")
    _verify_oauth_state("google", state)

    # Exchange code for tokens
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
        )

    if token_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Google 授权失败")

    tokens = token_resp.json()
    access_token = tokens.get("access_token")

    # Get user info
    async with httpx.AsyncClient() as client:
        user_resp = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if user_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="获取 Google 用户信息失败")

    user_info = user_resp.json()
    email = user_info.get("email")
    google_id = user_info.get("id")

    if not email:
        raise HTTPException(status_code=400, detail="无法获取邮箱")

    # Find or create user
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            hashed_password=None,
            api_key=secrets.token_urlsafe(32),
            oauth_provider="google",
            oauth_provider_id=google_id,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif not user.oauth_provider:
        # Link existing account
        user.oauth_provider = "google"
        user.oauth_provider_id = google_id
        db.commit()

    token = create_access_token({"sub": user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "plan": user.plan,
        },
    }


# --- GitHub OAuth ---


@router.get("/github/url")
def github_auth_url():
    """Return the GitHub OAuth authorization URL."""
    if not settings.github_client_id:
        raise HTTPException(status_code=503, detail="GitHub OAuth 未配置")

    state = _create_oauth_state("github")

    url = (
        "https://github.com/login/oauth/authorize?"
        f"client_id={settings.github_client_id}"
        f"&redirect_uri={settings.github_redirect_uri}"
        "&scope=user:email"
        f"&state={state}"
    )
    return {"url": url}


@router.get("/github/callback")
async def github_callback(
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
):
    """Handle GitHub OAuth callback, create/login user, return JWT."""
    if not settings.github_client_id or not settings.github_client_secret:
        raise HTTPException(status_code=503, detail="GitHub OAuth 未配置")
    _verify_oauth_state("github", state)

    # Exchange code for access token
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": settings.github_redirect_uri,
            },
        )

    if token_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="GitHub 授权失败")

    tokens = token_resp.json()
    access_token = tokens.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="GitHub 授权失败: 无 access_token")

    # Get user info
    async with httpx.AsyncClient() as client:
        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        email_resp = await client.get(
            "https://api.github.com/user/emails",
            headers={"Authorization": f"Bearer {access_token}"},
        )

    if user_resp.status_code != 200:
        raise HTTPException(status_code=400, detail="获取 GitHub 用户信息失败")

    user_info = user_resp.json()
    github_id = str(user_info.get("id"))

    # Get primary email
    email = user_info.get("email")
    if not email and email_resp.status_code == 200:
        emails = email_resp.json()
        for e in emails:
            if e.get("primary") and e.get("verified"):
                email = e.get("email")
                break
        if not email and emails:
            email = emails[0].get("email")

    if not email:
        raise HTTPException(status_code=400, detail="无法获取 GitHub 邮箱，请确保邮箱已公开或已验证")

    # Find or create user
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            hashed_password=None,
            api_key=secrets.token_urlsafe(32),
            oauth_provider="github",
            oauth_provider_id=github_id,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    elif not user.oauth_provider:
        user.oauth_provider = "github"
        user.oauth_provider_id = github_id
        db.commit()

    token = create_access_token({"sub": user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "plan": user.plan,
        },
    }
