from datetime import datetime

from pydantic import BaseModel, Field


class LibrarySongResponse(BaseModel):
    song_id: int
    played_at: datetime


class PlaylistCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class PlaylistResponse(BaseModel):
    id: int
    name: str
    song_ids: list[int]
    created_at: datetime