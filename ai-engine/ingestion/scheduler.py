"""
APScheduler — Monthly automated data pull.
Trigger: hujung bulan @ 11:00 PM (hari terakhir setiap bulan).
Manual trigger juga boleh melalui endpoint /ai/scheduler/trigger.
"""

import os
import logging
from datetime import datetime

logger = logging.getLogger(__name__)
_scheduler = None


def get_scheduler():
    global _scheduler
    if _scheduler is None:
        try:
            from apscheduler.schedulers.asyncio import AsyncIOScheduler
            from apscheduler.triggers.cron import CronTrigger
            _scheduler = AsyncIOScheduler()
            _scheduler.add_job(
                monthly_pull_job,
                CronTrigger(day="last", hour=23, minute=0),
                id="monthly_pull",
                name="Monthly Data Pull",
                replace_existing=True,
            )
            logger.info("[Scheduler] Monthly pull job registered — fires last day of month @ 23:00")
        except ImportError:
            logger.warning("[Scheduler] APScheduler not installed — scheduler disabled")
    return _scheduler


async def monthly_pull_job():
    """
    Job yang dijalankan setiap hujung bulan.
    Calls backend /api/v1/ingestion/scheduled-pull untuk trigger pull semua sumber aktif.
    Backend akan proses dan simpan ingestion_records.
    """
    import httpx
    now = datetime.now()
    logger.info(f"[Scheduler] Monthly pull triggered: {now.isoformat()}")

    backend_url = os.getenv("BACKEND_URL", "http://localhost:5000")
    scheduler_token = os.getenv("SCHEDULER_SECRET", "prestij25-scheduler-secret")

    try:
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(
                f"{backend_url}/api/v1/ingestion/scheduled-pull",
                headers={"X-Scheduler-Token": scheduler_token},
                json={"month": now.month, "year": now.year, "run_type": "scheduled"},
            )
            logger.info(f"[Scheduler] Backend response: {resp.status_code} — {resp.text[:200]}")
    except Exception as e:
        logger.error(f"[Scheduler] Monthly pull failed: {e}")


def scheduler_status() -> dict:
    s = get_scheduler()
    if s is None:
        return {"enabled": False, "reason": "APScheduler not available"}
    jobs = s.get_jobs()
    return {
        "enabled":   s.running,
        "jobs":      [{"id": j.id, "name": j.name, "next_run": str(j.next_run_time)} for j in jobs],
    }
