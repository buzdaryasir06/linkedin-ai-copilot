"""
backend/app/routers/batch_scoring.py

Batch job scoring and job tracking endpoints for Dashboard v2.0:
- POST /batch-score-jobs: Score multiple jobs in batch
- POST /jobs/track: Save a tracked job
- GET /jobs: List tracked jobs with pagination/filtering
- GET /jobs/{id}: Get single job
- PUT /jobs/{id}: Update job
- DELETE /jobs/{id}: Delete job
- GET /jobs/stats: Dashboard statistics
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from datetime import datetime
import logging

from ..models import (
    BatchScoreRequest,
    TrackJobRequest,
    JobUpdateRequest,
    BatchSaveJobsRequest,
)
from ..services import match_jobs_batch_service
from ..database import (
    save_tracked_job,
    get_tracked_job,
    list_tracked_jobs,
    update_tracked_job,
    delete_tracked_job,
    get_job_stats,
)

router = APIRouter(prefix="/jobs", tags=["job-tracking"])
logger = logging.getLogger(__name__)


@router.post("/batch-score-jobs")
async def batch_score_jobs(request: BatchScoreRequest):
    """Score multiple jobs against user profile in batch."""
    try:
        jobs = [job.model_dump() for job in request.jobs]
        user_profile = request.user_profile.model_dump()

        logger.info(f"[Batch Scoring] Processing {len(jobs)} jobs (quick_mode={request.quick_mode})")

        start_time = datetime.utcnow()
        results = await match_jobs_batch_service(
            jobs=jobs,
            user_profile=user_profile,
            quick_mode=request.quick_mode,
        )
        elapsed_ms = int((datetime.utcnow() - start_time).total_seconds() * 1000)

        batch_id = f"batch_{datetime.utcnow().timestamp()}"

        logger.info(f"[Batch Scoring] Completed batch {batch_id}: {len(results)} results in {elapsed_ms}ms")

        return {
            "success": True,
            "results": results,
            "batch_id": batch_id,
            "processed_count": len(results),
            "processing_time_ms": elapsed_ms,
            "api_version": "v2.1",
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Batch Scoring] Error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Batch scoring failed: " + str(e)
        )


@router.post("/track")
async def track_job(request: TrackJobRequest):
    """Save an analyzed job to user's tracking dashboard."""
    try:
        job_data = request.model_dump()
        job = await save_tracked_job(job_data)
        logger.info(f"[Track Job] Saved {request.job_title} at {request.company_name}")
        return {"success": True, "job": job}

    except Exception as e:
        logger.error(f"[Track Job] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/")
async def list_jobs(
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    status: Optional[str] = None,
    minMatch: Optional[int] = Query(None, ge=0, le=100),
    search: Optional[str] = None,
    sortBy: str = "created_at",
    sortOrder: str = Query("desc", regex="^(asc|desc)$"),
):
    """
    List tracked jobs with filtering, sorting, pagination.

    Examples:
    - GET /jobs?page=1&pageSize=10&status=new
    - GET /jobs?page=1&minMatch=70&sortBy=match_percentage
    - GET /jobs?search=Python&sortOrder=asc
    """
    try:
        filters = {}
        if status:
            filters["status"] = status.split(",")
        if minMatch is not None:
            filters["min_match_percentage"] = minMatch

        result = await list_tracked_jobs(
            page=page,
            pageSize=pageSize,
            filters=filters,
            search=search,
            sortBy=sortBy,
            sortOrder=sortOrder,
        )

        return {
            "success": True,
            "jobs": result["jobs"],
            "total": result["total"],
            "page": page,
            "pageSize": pageSize,
            "totalPages": (result["total"] + pageSize - 1) // pageSize,
        }

    except Exception as e:
        logger.error(f"[List Jobs] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_stats():
    """
    Get dashboard statistics:
    - Total jobs tracked
    - Average match %
    - Breakdown by ranking/status
    - Conversion funnel
    """
    try:
        stats = await get_job_stats()
        return {"success": True, "stats": stats}

    except Exception as e:
        logger.error(f"[Get Stats] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{job_id}")
async def get_job(job_id: str):
    """Get a single tracked job by ID"""
    try:
        job = await get_tracked_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        return {"success": True, "job": job}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Get Job] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{job_id}")
async def update_job(job_id: str, updates: JobUpdateRequest):
    """Update job metadata (status, notes, dates, salary)."""
    try:
        filtered_updates = updates.model_dump(exclude_none=True)

        job = await update_tracked_job(job_id, filtered_updates)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        logger.info(f"[Update Job] Updated job {job_id}")
        return {"success": True, "job": job}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Update Job] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{job_id}")
async def delete_job(job_id: str):
    """Delete a tracked job"""
    try:
        success = await delete_tracked_job(job_id)
        if not success:
            raise HTTPException(status_code=404, detail="Job not found")

        logger.info(f"[Delete Job] Deleted job {job_id}")
        return {"success": True, "message": "Job deleted"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Delete Job] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch")
async def batch_save_jobs(request: BatchSaveJobsRequest):
    """Bulk save multiple jobs (for importing/migration, max 100)."""
    try:
        saved_jobs = []
        for job_req in request.jobs:
            job = await save_tracked_job(job_req.model_dump())
            saved_jobs.append(job)

        logger.info(f"[Batch Save] Saved {len(saved_jobs)} jobs")
        return {
            "success": True,
            "saved_count": len(saved_jobs),
            "jobs": saved_jobs,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Batch Save] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
