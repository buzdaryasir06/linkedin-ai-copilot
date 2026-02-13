"""
routers/comments.py – Comment Mode endpoint.

POST /generate-comment
Accepts a LinkedIn post text, returns 3 AI-generated comment suggestions.
"""

import logging
from fastapi import APIRouter, HTTPException

from ..models import CommentRequest, CommentResponse
from ..services import generate_comments

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Comment Mode"])


@router.post("/generate-comment", response_model=CommentResponse)
async def create_comment_suggestions(request: CommentRequest):
    """
    Generate 3 LinkedIn comment suggestions for a given post.

    Returns authority, question, and strategic style comments.
    """
    logger.info("Generating comments for post (%d chars)", len(request.post_text))

    try:
        comments = await generate_comments(
            post_text=request.post_text,
            tone=request.tone,
        )
        return CommentResponse(
            post_text=request.post_text,
            comments=comments,
        )
    except ValueError as e:
        logger.warning("Comment generation failed: %s", e)
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error("Unexpected error in comment generation: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Failed to generate comments. Please check your API key and try again.",
        )
