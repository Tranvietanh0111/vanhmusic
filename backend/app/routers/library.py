from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.models.music_library import Playlist, PlaylistSong, RecentlyPlayed, SongLike
from app.models.song import Song
from app.routers.auth import get_current_user
from app.schemas.library import LibrarySongResponse, PlaylistCreate, PlaylistResponse

router = APIRouter(prefix="/library", tags=["Library"])


@router.get("/likes", response_model=list[int])
def get_likes(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    return [
        item.song_id
        for item in db.query(SongLike)
        .filter(SongLike.user_id == current_user.id)
        .all()
    ]


@router.post("/likes/{song_id}", response_model=list[int])
def like_song(
    song_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    song = db.query(Song).filter(Song.id == song_id).first()

    if not song:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài hát")

    existing = (
        db.query(SongLike)
        .filter(
            SongLike.user_id == current_user.id,
            SongLike.song_id == song_id,
        )
        .first()
    )

    if not existing:
        db.add(SongLike(user_id=current_user.id, song_id=song_id))
        db.commit()

    return get_likes(current_user, db)


@router.get("/recent", response_model=list[LibrarySongResponse])
def get_recent(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(RecentlyPlayed)
        .filter(RecentlyPlayed.user_id == current_user.id)
        .order_by(RecentlyPlayed.played_at.desc())
        .limit(30)
        .all()
    )

    return [
        {
            "song_id": row.song_id,
            "played_at": row.played_at,
        }
        for row in rows
    ]


@router.post("/recent/{song_id}", response_model=list[LibrarySongResponse])
def add_recent(
    song_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    song = db.query(Song).filter(Song.id == song_id).first()

    if not song:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài hát")

    row = (
        db.query(RecentlyPlayed)
        .filter(
            RecentlyPlayed.user_id == current_user.id,
            RecentlyPlayed.song_id == song_id,
        )
        .first()
    )

    if row:
        row.played_at = datetime.utcnow()
    else:
        db.add(
            RecentlyPlayed(
                user_id=current_user.id,
                song_id=song_id,
            )
        )

    db.commit()

    return get_recent(current_user, db)


@router.get("/playlists", response_model=list[PlaylistResponse])
def get_playlists(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    playlists = (
        db.query(Playlist)
        .filter(Playlist.owner_id == current_user.id)
        .order_by(Playlist.created_at.desc())
        .all()
    )

    return [
        {
            "id": playlist.id,
            "name": playlist.name,
            "song_ids": [
                item.song_id
                for item in db.query(PlaylistSong)
                .filter(PlaylistSong.playlist_id == playlist.id)
                .all()
            ],
            "created_at": playlist.created_at,
        }
        for playlist in playlists
    ]


@router.post("/playlists", response_model=PlaylistResponse)
def create_playlist(
    data: PlaylistCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    name = data.name.strip()

    if not name:
        raise HTTPException(status_code=400, detail="Tên playlist không được để trống")

    playlist = Playlist(
        name=name,
        owner_id=current_user.id,
    )

    db.add(playlist)
    db.commit()
    db.refresh(playlist)

    return {
        "id": playlist.id,
        "name": playlist.name,
        "song_ids": [],
        "created_at": playlist.created_at,
    }


@router.delete("/playlists/{playlist_id}")
def delete_playlist(
    playlist_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    playlist = (
        db.query(Playlist)
        .filter(
            Playlist.id == playlist_id,
            Playlist.owner_id == current_user.id,
        )
        .first()
    )

    if not playlist:
        raise HTTPException(status_code=404, detail="Không tìm thấy playlist")

    db.query(PlaylistSong).filter(
        PlaylistSong.playlist_id == playlist.id
    ).delete()

    db.delete(playlist)
    db.commit()

    return {"message": "Đã xóa playlist"}


@router.post("/playlists/{playlist_id}/songs/{song_id}")
def add_song_to_playlist(
    playlist_id: int,
    song_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    playlist = (
        db.query(Playlist)
        .filter(
            Playlist.id == playlist_id,
            Playlist.owner_id == current_user.id,
        )
        .first()
    )

    if not playlist:
        raise HTTPException(status_code=404, detail="Không tìm thấy playlist")

    song = db.query(Song).filter(Song.id == song_id).first()

    if not song:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài hát")

    existing = (
        db.query(PlaylistSong)
        .filter(
            PlaylistSong.playlist_id == playlist_id,
            PlaylistSong.song_id == song_id,
        )
        .first()
    )

    if not existing:
        db.add(
            PlaylistSong(
                playlist_id=playlist_id,
                song_id=song_id,
            )
        )
        db.commit()

    return {"message": "Đã thêm bài hát vào playlist"}


@router.delete("/playlists/{playlist_id}/songs/{song_id}")
def remove_song_from_playlist(
    playlist_id: int,
    song_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    playlist = (
        db.query(Playlist)
        .filter(
            Playlist.id == playlist_id,
            Playlist.owner_id == current_user.id,
        )
        .first()
    )

    if not playlist:
        raise HTTPException(status_code=404, detail="Không tìm thấy playlist")

    item = (
        db.query(PlaylistSong)
        .filter(
            PlaylistSong.playlist_id == playlist_id,
            PlaylistSong.song_id == song_id,
        )
        .first()
    )

    if item:
        db.delete(item)
        db.commit()

    return {"message": "Đã xóa bài hát khỏi playlist"}