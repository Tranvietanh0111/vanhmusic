from pydantic import BaseModel, ConfigDict


class SongResponse(BaseModel):
    id: int
    title: str
    artist: str
    album: str | None = None
    file_name: str
    duration: float | None = None
    stream_url: str

    model_config = ConfigDict(from_attributes=True)
