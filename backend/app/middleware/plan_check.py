"""
Plan-based access control middleware.
Usage:
    @router.post("/some-endpoint", dependencies=[Depends(require_plan("pro"))])
    def endpoint(...):
        ...
"""

from fastapi import Depends, HTTPException, status

from ..models import User
from ..routers.auth import get_current_user


PLAN_HIERARCHY = {"free": 0, "pro": 1, "team": 2}


def require_plan(minimum_plan: str):
    """
    Returns a dependency that checks the current user's plan meets the minimum.
    - "pro"  -> allows pro, team
    - "team" -> allows team only
    """
    min_level = PLAN_HIERARCHY.get(minimum_plan, 0)

    def _check(current_user: User = Depends(get_current_user)):
        user_level = PLAN_HIERARCHY.get(current_user.plan, 0)
        if user_level < min_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"此功能需要 {minimum_plan} 或更高套餐，当前套餐: {current_user.plan}",
            )
        return current_user

    return _check
