"""
AI comment generation router.
POST /api/ai/comment - Generate AI-powered comments for Xiaohongshu notes.
Requires Pro or Team plan.
"""

import json
import logging
import random
import re

from fastapi import APIRouter, Depends, HTTPException
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

from ..config import settings
from ..middleware.plan_check import require_plan
from ..models import User

router = APIRouter()
logger = logging.getLogger(__name__)

# --- Prompt templates ---

STYLE_PROMPTS = {
    "positive": (
        "你是一个积极正面的小红书用户。请根据以下笔记内容，写一条真诚、热情、自然的中文评论。"
        "评论要像真人一样，避免过于官方或机器感。30-80字。"
    ),
    "curious": (
        "你是一个对内容很感兴趣、充满好奇心的小红书用户。请根据以下笔记内容，写一条提问式的中文评论。"
        "自然地表达好奇，追问细节。30-80字。"
    ),
    "share": (
        "你是一个乐于分享经验的小红书用户。请根据以下笔记内容，写一条分享自己相关经验的中文评论。"
        "用第一人称，语气自然亲切。30-80字。"
    ),
    "persona": (
        "你是一个有个性的小红书用户，说话风格随性，偶尔用网络流行语或缩写。"
        "请根据以下笔记内容，写一条有个人特色的中文评论。30-80字。"
    ),
}

ALL_STYLES = list(STYLE_PROMPTS.keys())


class CommentRequest(BaseModel):
    content: str
    style: str = "random"  # positive, curious, share, persona, random


class CommentResponse(BaseModel):
    comment: str
    style_used: str


class PersonaCandidate(BaseModel):
    id: str | None = None
    title: str = Field(min_length=1, max_length=40)
    description: str = Field(min_length=1, max_length=180)
    full_text: str | None = None
    source: str = "rule"
    confidence: float | None = None
    reason: str = ""
    tags: list[str] = Field(default_factory=list)


class PersonaRecommendationRequest(BaseModel):
    scene: str
    skill: str = ""
    task: str = ""
    mode: str = ""
    vertical: str = ""
    verticalCustom: str = ""
    tone: str = ""
    goal: str = ""
    existingPersona: str = ""
    candidateCount: int = Field(default=4, ge=1, le=6)
    seedCandidates: list[PersonaCandidate] = Field(default_factory=list)


class PersonaRecommendationResponse(BaseModel):
    recommendations: list[PersonaCandidate]
    strategy: str


def _get_ai_client() -> AsyncOpenAI:
    return AsyncOpenAI(
        api_key=settings.openai_api_key,
        base_url=settings.openai_base_url,
    )


def _normalize_candidate(candidate: PersonaCandidate | dict, default_source: str = "rule") -> PersonaCandidate:
    item = candidate if isinstance(candidate, dict) else candidate.model_dump()
    title = (item.get("title") or "").strip()
    description = (item.get("description") or item.get("text") or item.get("reason") or "").strip()
    full_text = (item.get("full_text") or item.get("fullText") or f"{title} - {description}").strip()
    return PersonaCandidate(
        id=item.get("id"),
        title=title,
        description=description,
        full_text=full_text,
        source=item.get("source") or default_source,
        confidence=item.get("confidence"),
        reason=(item.get("reason") or "").strip(),
        tags=list(item.get("tags") or [])[:3],
    )


def _dedupe_candidates(candidates: list[PersonaCandidate], limit: int) -> list[PersonaCandidate]:
    unique: list[PersonaCandidate] = []
    seen: set[str] = set()
    for candidate in candidates:
        key = (candidate.full_text or f"{candidate.title}-{candidate.description}").strip()
        if key and key not in seen:
            seen.add(key)
            unique.append(candidate)
        if len(unique) >= limit:
            break
    return unique


def _extract_json_array(text: str) -> list[dict]:
    payload = text.strip()
    try:
        data = json.loads(payload)
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        match = re.search(r"\[[\s\S]*\]", payload)
        if not match:
            return []
        try:
            data = json.loads(match.group(0))
            return data if isinstance(data, list) else []
        except json.JSONDecodeError:
            return []


@router.post("/comment", response_model=CommentResponse)
async def generate_comment(
    req: CommentRequest,
    current_user: User = Depends(require_plan("pro")),
):
    """Generate an AI comment for a Xiaohongshu note. Pro/Team only."""
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="AI 服务未配置")

    # Resolve style
    style = req.style
    if style == "random" or style not in STYLE_PROMPTS:
        style = random.choice(ALL_STYLES)

    system_prompt = STYLE_PROMPTS[style]

    client = _get_ai_client()

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"笔记内容:\n{req.content[:2000]}"},
            ],
            max_tokens=200,
            temperature=0.9,
        )
        comment = response.choices[0].message.content.strip()
        # Remove surrounding quotes if present
        if (comment.startswith('"') and comment.endswith('"')) or (
            comment.startswith("'") and comment.endswith("'")
        ):
            comment = comment[1:-1]

        return CommentResponse(comment=comment, style_used=style)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"AI 生成失败: {str(e)}")


@router.post("/recommend/persona", response_model=PersonaRecommendationResponse)
async def recommend_persona(
    req: PersonaRecommendationRequest,
    current_user: User = Depends(require_plan("pro")),
):
    fallback = _dedupe_candidates(
        [_normalize_candidate(candidate, "rule") for candidate in req.seedCandidates],
        max(1, min(req.candidateCount, 6)),
    )

    if not settings.openai_api_key:
        logger.info("persona_recommendation fallback=rule_only reason=no_openai_key scene=%s user_id=%s", req.scene, current_user.id)
        return PersonaRecommendationResponse(recommendations=fallback, strategy="rule_only")

    client = _get_ai_client()
    scene_label = "AI 评论人设" if req.scene == "comment_persona" else "内容人设"
    context_summary = {
        "scene": req.scene,
        "skill": req.skill,
        "task": req.task,
        "mode": req.mode,
        "vertical": req.vertical,
        "verticalCustom": req.verticalCustom,
        "tone": req.tone,
        "goal": req.goal,
        "existingPersona": req.existingPersona,
    }
    seed_json = json.dumps([candidate.model_dump() for candidate in fallback], ensure_ascii=False, indent=2)
    context_json = json.dumps(context_summary, ensure_ascii=False, indent=2)

    system_prompt = (
        f"你是一个负责给小红书自动化产品生成 {scene_label} 推荐的策略助手。"
        "你要优先基于给定的规则候选做优化、重写、补充理由和标签，而不是完全脱离上下文自由发挥。"
        "输出必须是 JSON 数组，每项包含 title, description, full_text, reason, tags。"
        "full_text 需要是可直接写回输入框的一整句。候选要具体、像真人、可执行，避免空泛。"
        f"最多输出 {max(1, min(req.candidateCount, 6))} 项。不要输出数组以外的任何文字。"
    )
    user_prompt = (
        f"当前上下文:\n{context_json}\n\n"
        f"默认规则候选:\n{seed_json}\n\n"
        "请在保留稳定性的前提下做增强：\n"
        "1. 优先改进现有候选，不够时再补充新的。\n"
        "2. 标题简短鲜明，描述说明视角和适用场景。\n"
        "3. tags 最多 3 个，适合前端展示。\n"
        "4. 如果已有候选已经很合适，可以保留其方向但优化表述。\n"
    )

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=900,
            temperature=0.7,
        )
        raw = (response.choices[0].message.content or "").strip()
        parsed = _extract_json_array(raw)
        if not parsed:
            logger.warning(
                "persona_recommendation fallback=rule_only reason=json_parse_empty scene=%s user_id=%s raw_preview=%s",
                req.scene,
                current_user.id,
                raw[:240],
            )
        ai_candidates = _dedupe_candidates(
            [_normalize_candidate(item, "ai") for item in parsed if isinstance(item, dict)],
            max(1, min(req.candidateCount, 6)),
        )
        if not ai_candidates:
            logger.info(
                "persona_recommendation fallback=rule_only reason=no_ai_candidates scene=%s user_id=%s seed_count=%s",
                req.scene,
                current_user.id,
                len(fallback),
            )
            return PersonaRecommendationResponse(recommendations=fallback, strategy="rule_only")

        recommendations = _dedupe_candidates(ai_candidates + fallback, max(1, min(req.candidateCount, 6)))
        logger.info(
            "persona_recommendation strategy=rule_plus_ai scene=%s user_id=%s seed_count=%s ai_count=%s output_count=%s",
            req.scene,
            current_user.id,
            len(fallback),
            len(ai_candidates),
            len(recommendations),
        )
        return PersonaRecommendationResponse(recommendations=recommendations, strategy="rule_plus_ai")
    except Exception as exc:
        logger.exception(
            "persona_recommendation fallback=rule_only reason=exception scene=%s user_id=%s error=%s",
            req.scene,
            current_user.id,
            exc,
        )
        return PersonaRecommendationResponse(recommendations=fallback, strategy="rule_only")
