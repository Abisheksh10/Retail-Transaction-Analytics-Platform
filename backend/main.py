"""Main FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.api.routes import analytics, transactions, auth, admin, products, etl

app = FastAPI(
    title=settings.APP_NAME,
    description="High-performance analytics API for Online Retail transaction data.",
    version="0.1.0",
    debug=settings.DEBUG,
)

# CORS Middleware for Frontend Integration
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(etl.router, prefix="/api")


@app.get("/health", tags=["system"])
async def health_check():
    """System health check endpoint."""
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "environment": settings.ENVIRONMENT,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=settings.API_HOST, port=settings.API_PORT, reload=settings.DEBUG)
