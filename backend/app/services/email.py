"""
Email service using Resend API.
Falls back to logging if Resend key is not configured.
"""

import logging
from typing import Optional

import httpx

from ..config import settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


async def _send_email(to: str, subject: str, html: str) -> bool:
    """Send an email via Resend API. Returns True on success."""
    if not settings.resend_api_key:
        logger.warning(f"[Email] Resend API key not set. Would send to={to} subject={subject}")
        logger.debug(f"[Email] HTML body: {html}")
        return False

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                RESEND_API_URL,
                headers={
                    "Authorization": f"Bearer {settings.resend_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": settings.email_from,
                    "to": [to],
                    "subject": subject,
                    "html": html,
                },
                timeout=10.0,
            )
            if resp.status_code in (200, 201):
                logger.info(f"[Email] Sent to {to}: {subject}")
                return True
            else:
                logger.error(f"[Email] Failed {resp.status_code}: {resp.text}")
                return False
    except Exception as e:
        logger.error(f"[Email] Exception sending to {to}: {e}")
        return False


async def send_welcome_email(email: str) -> bool:
    return await _send_email(
        to=email,
        subject="欢迎加入养薯户!",
        html="""
        <h2>欢迎加入养薯户!</h2>
        <p>感谢您的注册，现在可以开始使用养薯户的所有免费功能了。</p>
        <p>如需解锁 AI 评论、定时任务等高级功能，请升级到 Pro 套餐。</p>
        <p>— 养薯户团队</p>
        """,
    )


async def send_magic_link(email: str, token: str) -> bool:
    link = f"{settings.frontend_url}/auth/magic-link?token={token}"
    return await _send_email(
        to=email,
        subject="养薯户 - 登录链接",
        html=f"""
        <h2>一键登录养薯户</h2>
        <p>点击下方链接登录您的账号（链接15分钟内有效）：</p>
        <p><a href="{link}" style="display:inline-block;padding:12px 24px;background:#ff4757;color:#fff;
        border-radius:6px;text-decoration:none;">点击登录</a></p>
        <p>如果您没有请求此链接，请忽略此邮件。</p>
        <p>— 养薯户团队</p>
        """,
    )


async def send_password_reset(email: str, token: str) -> bool:
    link = f"{settings.frontend_url}/auth/reset-password?token={token}"
    return await _send_email(
        to=email,
        subject="养薯户 - 重置密码",
        html=f"""
        <h2>重置密码</h2>
        <p>点击下方链接重置您的密码（链接15分钟内有效）：</p>
        <p><a href="{link}" style="display:inline-block;padding:12px 24px;background:#ff4757;color:#fff;
        border-radius:6px;text-decoration:none;">重置密码</a></p>
        <p>如果您没有请求重置密码，请忽略此邮件。</p>
        <p>— 养薯户团队</p>
        """,
    )


async def send_subscription_notification(email: str, plan: str, action: str) -> bool:
    action_text = {
        "created": f"您已成功订阅 {plan.upper()} 套餐!",
        "updated": f"您的套餐已更新为 {plan.upper()}。",
        "canceled": "您的订阅已取消，当前套餐将在到期后降级为免费版。",
    }.get(action, f"订阅状态更新: {action}")

    return await _send_email(
        to=email,
        subject=f"养薯户 - 订阅{action_text[:4]}",
        html=f"""
        <h2>订阅通知</h2>
        <p>{action_text}</p>
        <p>如有疑问，请联系客服。</p>
        <p>— 养薯户团队</p>
        """,
    )
