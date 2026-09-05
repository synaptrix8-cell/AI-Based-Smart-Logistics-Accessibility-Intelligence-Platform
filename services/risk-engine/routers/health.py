"""
Health check endpoint.
Returns service status, version, and uptime for monitoring/deployment checks.
"""

import time
from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/health")
async def health_check(request: Request):
    """
    Health check endpoint.
    
    Returns:
        status: "healthy"
        version: current service version
        uptime_seconds: time since service start
        environment: current environment (dev/staging/prod)
    """
    start_time = getattr(request.app.state, "start_time", time.time())
    uptime = round(time.time() - start_time, 2)

    return {
        "status": "healthy",
        "service": "setu-risk-engine",
        "version": "0.1.0",
        "uptime_seconds": uptime,
        "environment": "development",
    }
