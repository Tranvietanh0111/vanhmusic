import mimetypes
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.song import Song
from app.models.user import User
from app.routers.auth import get_current_user
from app.schemas.song import SongResponse

router = APIRouter(prefix="/songs", tags=["Songs"])

BASE_DIR = Path(__file__).resolve().parents[2]
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
ALLOWED_EXTENSIONS = {".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac", ".webm"}


def song_response(song: Song) -> SongResponse:
    return SongResponse(
        id=song.id,
        title=song.title,
        artist=song.artist,
        album=song.album,
        file_name=song.file_name,
        duration=song.duration,
        stream_url=f"/songs/{song.id}/stream",
    )


@router.get("", response_model=list[SongResponse])
def get_songs(db: Session = Depends(get_db)):
    songs = db.query(Song).order_by(Song.created_at.desc()).all()
    return [song_response(song) for song in songs]


@router.post("/upload", response_model=SongResponse, status_code=status.HTTP_201_CREATED)
async def upload_song(
    file: UploadFile = File(...),
    title: str | None = Form(None),
    artist: str | None = Form(None),
    album: str | None = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    original_name = Path(file.filename or "song").name
    extension = Path(original_name).suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Định dạng nhạc không được hỗ trợ")

    stored_name = f"{uuid.uuid4().hex}{extension}"
    destination = UPLOAD_DIR / stored_name

    try:
        with destination.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                output.write(chunk)

        song = Song(
            title=(title or Path(original_name).stem).strip() or Path(original_name).stem,
            artist=(artist or "Unknown Artist").strip() or "Unknown Artist",
            album=(album or "").strip() or None,
            file_name=original_name,
            file_path=str(destination),
            owner_id=current_user.id,
        )
        db.add(song)
        db.commit()
        db.refresh(song)
        return song_response(song)
    except Exception:
        if destination.exists():
            destination.unlink()
        db.rollback()
        raise HTTPException(status_code=500, detail="Không thể lưu bài hát")
    finally:
        await file.close()


@router.delete("/{song_id}")
def delete_song(
    song_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài hát")
    if song.owner_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Bạn không có quyền xóa bài hát này")

    if os.path.exists(song.file_path):
        os.remove(song.file_path)
    db.delete(song)
    db.commit()
    return {"message": "Đã xóa bài hát"}


@router.get("/{song_id}/stream")
def stream_song(song_id: int, range_header: str | None = Header(default=None, alias="Range"), db: Session = Depends(get_db)):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song or not os.path.exists(song.file_path):
        raise HTTPException(status_code=404, detail="Không tìm thấy file nhạc")

    file_path = Path(song.file_path)
    file_size = file_path.stat().st_size
    media_type = mimetypes.guess_type(song.file_name)[0] or "audio/mpeg"
    start = 0
    end = file_size - 1
    status_code = 200

    if range_header:
        try:
            value = range_header.replace("bytes=", "", 1).split(",")[0].strip()
            start_text, end_text = value.split("-", 1)
            if start_text:
                start = int(start_text)
            if end_text:
                end = int(end_text)
            else:
                end = file_size - 1
            if start < 0 or end >= file_size or start > end:
                raise ValueError
            status_code = 206
        except ValueError:
            raise HTTPException(status_code=416, detail="Range không hợp lệ")

    content_length = end - start + 1

    def iter_file():
        with file_path.open("rb") as file:
            file.seek(start)
            remaining = content_length
            while remaining > 0:
                chunk = file.read(min(1024 * 1024, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    headers = {
        "Content-Length": str(content_length),
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
    }
    if status_code == 206:
        headers["Content-Range"] = f"bytes {start}-{end}/{file_size}"

    return StreamingResponse(iter_file(), status_code=status_code, media_type=media_type, headers=headers)
