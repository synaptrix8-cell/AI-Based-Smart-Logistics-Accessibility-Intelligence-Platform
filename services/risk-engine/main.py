"""
Setu Risk Engine — FastAPI Application
AI-Based Smart Logistics & Accessibility Intelligence Platform

This service handles:
- Road segment risk scoring (weather, terrain, field reports)
- Safe-route computation (Dijkstra/A* on a weighted road graph)
- Health monitoring endpoint
"""

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from routers import health, risk, routing


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events for the FastAPI app."""
    app.state.start_time = time.time()
    # Phase 2: Load road graph into memory here
    # app.state.road_graph = load_road_graph()
    print(f"🚀 Setu Risk Engine starting (env: {settings.ENVIRONMENT})")
    yield
    print("🛑 Setu Risk Engine shutting down")


app = FastAPI(
    title="Setu Risk Engine",
    description="Risk scoring and safe-route computation for NER logistics",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — locked to known origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Routers
app.include_router(health.router, tags=["Health"])
app.include_router(risk.router, prefix="/api/v1/risk", tags=["Risk Scoring"])
app.include_router(routing.router, prefix="/api/v1/routing", tags=["Routing"])


@app.get("/", include_in_schema=False)
async def root():
    return {"service": "Setu Risk Engine", "version": "0.1.0", "status": "running"}
