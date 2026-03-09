import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import User
from ..services.email import send_magic_link, send_password_reset, send_welcome_email

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


# --- Schemas ---


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class UserResponse(BaseModel):
    id: int
    email: str
    plan: str
    api_key: str | None
    subscription_status: str | None = None

    class Config:
        from_attributes = True


class MagicLinkRequest(BaseModel):
    email: EmailStr


class MagicLinkVerify(BaseModel):
    token: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str


# --- Token & Auth helpers ---


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    db: Session = Depends(get_db),
) -> User:
    """
    Authenticate user via:
    1. Bearer token (OAuth2)
    2. X-API-Key header
    """
    # Try API Key first
    if x_api_key:
        user = db.query(User).filter(User.api_key == x_api_key).first()
        if user:
            return user
        raise HTTPException(status_code=401, detail="Invalid API key")

    # Fall back to Bearer token
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_current_user_by_api_key(
    x_api_key: str = Header(..., alias="X-API-Key"),
    db: Session = Depends(get_db),
) -> User:
    """Authenticate user strictly via X-API-Key header."""
    user = db.query(User).filter(User.api_key == x_api_key).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return user


# --- Endpoints ---


@router.post("/register", response_model=UserResponse)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=user_data.email,
        hashed_password=pwd_context.hash(user_data.password),
        api_key=secrets.token_urlsafe(32),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Send welcome email (fire and forget)
    await send_welcome_email(user.email)

    return user


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not user.hashed_password or not pwd_context.verify(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/regenerate-api-key")
def regenerate_api_key(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Regenerate the user's API key."""
    current_user.api_key = secrets.token_urlsafe(32)
    db.commit()
    return {"api_key": current_user.api_key}


# --- Magic Link ---


@router.post("/magic-link")
async def request_magic_link(req: MagicLinkRequest, db: Session = Depends(get_db)):
    """Send a magic login link to the user's email."""
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        # Don't reveal whether email exists
        return {"message": "如果该邮箱已注册，登录链接已发送"}

    token = secrets.token_urlsafe(32)
    user.magic_link_token = token
    user.magic_link_expires = datetime.utcnow() + timedelta(minutes=15)
    db.commit()

    await send_magic_link(user.email, token)
    return {"message": "如果该邮箱已注册，登录链接已发送"}


@router.post("/magic-link/verify", response_model=Token)
def verify_magic_link(req: MagicLinkVerify, db: Session = Depends(get_db)):
    """Verify magic link token and return JWT."""
    user = db.query(User).filter(User.magic_link_token == req.token).first()
    if not user:
        raise HTTPException(status_code=400, detail="无效或已过期的链接")

    if user.magic_link_expires and user.magic_link_expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail="链接已过期，请重新获取")

    # Clear the token
    user.magic_link_token = None
    user.magic_link_expires = None
    db.commit()

    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}


# --- Password Reset ---


@router.post("/password-reset/request")
async def request_password_reset(req: PasswordResetRequest, db: Session = Depends(get_db)):
    """Send a password reset link."""
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        return {"message": "如果该邮箱已注册，重置链接已发送"}

    token = secrets.token_urlsafe(32)
    user.magic_link_token = token
    user.magic_link_expires = datetime.utcnow() + timedelta(minutes=15)
    db.commit()

    await send_password_reset(user.email, token)
    return {"message": "如果该邮箱已注册，重置链接已发送"}


@router.post("/password-reset/confirm", response_model=Token)
def confirm_password_reset(req: PasswordResetConfirm, db: Session = Depends(get_db)):
    """Reset password using token."""
    user = db.query(User).filter(User.magic_link_token == req.token).first()
    if not user:
        raise HTTPException(status_code=400, detail="无效或已过期的链接")

    if user.magic_link_expires and user.magic_link_expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail="链接已过期，请重新获取")

    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="密码长度至少6位")

    user.hashed_password = pwd_context.hash(req.new_password)
    user.magic_link_token = None
    user.magic_link_expires = None
    db.commit()

    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}
