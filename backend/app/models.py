from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship

from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)  # nullable for OAuth users
    plan = Column(String, default="free")  # free, pro, team
    api_key = Column(String, unique=True, index=True)
    stripe_customer_id = Column(String, unique=True)
    stripe_subscription_id = Column(String, unique=True)
    subscription_status = Column(String, default=None)  # active, canceled, past_due
    subscription_end_date = Column(DateTime, default=None)
    magic_link_token = Column(String, default=None)
    magic_link_expires = Column(DateTime, default=None)
    oauth_provider = Column(String, default=None)  # google, github
    oauth_provider_id = Column(String, default=None)
    created_at = Column(DateTime, default=datetime.utcnow)

    stats = relationship("TaskStats", back_populates="user")


class TaskStats(Base):
    __tablename__ = "task_stats"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(String, nullable=False)  # YYYY-MM-DD
    browse_count = Column(Integer, default=0)
    like_count = Column(Integer, default=0)
    collect_count = Column(Integer, default=0)
    comment_count = Column(Integer, default=0)
    follow_count = Column(Integer, default=0)

    user = relationship("User", back_populates="stats")


class TaskLog(Base):
    __tablename__ = "task_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String, nullable=False)
    detail = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
