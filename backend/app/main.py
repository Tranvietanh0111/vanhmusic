from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.base import Base
from app.database.database import engine
from app.models import (
    Playlist,
    PlaylistSong,
    RecentlyPlayed,
    Song,
    SongLike,
    User,
)
from app.routers.auth import router as auth_router
from app.routers.library import router as library_router
from app.routers.song import router as song_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="VanhMusic API",
    version="1.0.0",
    description="Backend API cho VanhMusic",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(song_router)
app.include_router(library_router)


@app.get("/")
def home():
    return {
        "message": "VanhMusic API đang chạy",
        "docs": "/docs",
    }