"""
Demucs backend for olkaraoke Add Song.

POST /api/songs/separate

multipart/form-data:
    songId      = song folder name
    audio       = audio file (optional -- provide this OR youtubeUrl, not both)
    youtubeUrl  = a YouTube video URL (optional -- provide this OR audio)
    txt         = UltraStar .txt file

Files created:

D:/PP/karaokeii/karaoke/public/songs/<songId>/
    <songId>.mp4    (the actual YouTube video when youtubeUrl is used, or a
                     silent black placeholder when a plain audio file is used)
    <songId>.txt
    vocals.mp3
    drums.mp3
    bass.mp3
    other.mp3
"""

import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

# IMPORTANT: change this only if your frontend project is somewhere else.
FRONTEND_DIR = Path(r"D:\PP\karaokeii\karaoke")

SONGS_DIR = FRONTEND_DIR / "public" / "songs"

SONGS_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# CONFIG
# ============================================================

MAX_UPLOAD_BYTES = 100 * 1024 * 1024

ACCEPTED_AUDIO_TYPES = {
    "audio/mpeg",
    "audio/wav",
    "audio/x-wav",
    "audio/flac",
    "audio/mp4",
    "audio/ogg",
    "audio/webm",
}


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(title="olkaraoke-demucs-backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://localhost:3000",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(
    "/songs",
    StaticFiles(directory=SONGS_DIR),
    name="songs",
)


# ============================================================
# HELPERS
# ============================================================

def safe_song_id(song_id: str) -> str:
    song_id = song_id.strip()
    if not song_id:
        raise HTTPException(status_code=400, detail="songId is required.")
    if not re.fullmatch(r"[A-Za-z0-9_-]+", song_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid songId. Use only letters, numbers, '-' and '_'.",
        )
    return song_id


async def save_upload(upload: UploadFile, destination: Path) -> None:
    size = 0
    with destination.open("wb") as output:
        while True:
            chunk = await upload.read(1024 * 1024)
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                raise HTTPException(status_code=400, detail="File too large. Maximum size is 100MB.")
            output.write(chunk)


YOUTUBE_URL_PATTERN = re.compile(
    r"^https?://(www\.)?(youtube\.com/watch\?v=|youtu\.be/)[\w-]+"
)


def validate_youtube_url(url: str) -> str:
    url = url.strip()
    if not YOUTUBE_URL_PATTERN.match(url):
        raise HTTPException(status_code=400, detail="That doesn't look like a valid YouTube URL.")
    return url


def download_youtube_video(url: str, output_path: Path) -> None:
    """
    Downloads the actual YouTube video (video + audio merged) directly to
    output_path as an mp4. This becomes the song's real background video --
    unlike a plain audio upload, no placeholder is needed here since we get
    genuine visuals for free.
    """
    try:
        subprocess.run(
            [
                "yt-dlp",
                "-f",
                "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
                "--merge-output-format",
                "mp4",
                "--no-playlist",
                "-o",
                str(output_path),
                url,
            ],
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Could not download video from that YouTube URL: {e.stderr}",
        ) from e

    if not output_path.exists():
        raise HTTPException(
            status_code=500,
            detail="YouTube download finished but no video file was produced.",
        )


def extract_audio_from_video(video_path: Path, output_audio_path: Path) -> None:
    """Pulls the audio track out of a video file as an mp3, for Demucs input."""
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(video_path),
            "-vn",
            "-ar",
            "44100",
            "-ac",
            "2",
            "-b:a",
            "192k",
            str(output_audio_path),
        ],
        check=True,
        capture_output=True,
    )


# ============================================================
# API
# ============================================================

@app.post("/api/songs/separate")
async def separate_song(
    songId: str = Form(...),
    txt: UploadFile = File(...),
    audio: Optional[UploadFile] = File(None),
    youtubeUrl: Optional[str] = Form(None),
):
    song_id = safe_song_id(songId)

    has_file = audio is not None and audio.filename
    has_youtube_url = bool(youtubeUrl and youtubeUrl.strip())

    if has_file and has_youtube_url:
        raise HTTPException(status_code=400, detail="Provide either an audio file or a YouTube URL, not both.")
    if not has_file and not has_youtube_url:
        raise HTTPException(status_code=400, detail="Provide either an audio file or a YouTube URL.")

    if has_file and audio.content_type not in ACCEPTED_AUDIO_TYPES:
        raise HTTPException(status_code=400, detail=f"Unsupported audio type: {audio.content_type}")

    validated_youtube_url = validate_youtube_url(youtubeUrl) if has_youtube_url else None

    txt_filename = txt.filename or ""
    if not txt_filename.lower().endswith(".txt"):
        raise HTTPException(status_code=400, detail="The TXT file must be an UltraStar .txt file.")

    song_dir = SONGS_DIR / song_id
    if song_dir.exists():
        raise HTTPException(status_code=409, detail=f"Song '{song_id}' already exists.")
    song_dir.mkdir(parents=True, exist_ok=False)

    temp_dir = Path(tempfile.mkdtemp(prefix=f"demucs_{song_id}_"))

    try:
        video_path = song_dir / f"{song_id}.mp4"

        if has_file:
            # Plain file upload: no real visuals available, so we still need
            # a silent placeholder video as before.
            original_extension = Path(audio.filename or "audio.mp3").suffix or ".mp3"
            input_audio = temp_dir / f"input{original_extension}"
            await save_upload(audio, input_audio)
            create_placeholder_video(input_audio, video_path)
        else:
            # YouTube: download the real video (with visuals) directly into
            # the song folder, then pull the audio out of it for Demucs.
            download_youtube_video(validated_youtube_url, video_path)
            input_audio = temp_dir / "extracted_audio.mp3"
            extract_audio_from_video(video_path, input_audio)

        # Save TXT directly into the song folder.
        txt_destination = song_dir / f"{song_id}.txt"
        await save_upload(txt, txt_destination)

        # Run separate song into stems (vocals, drums, bass, other) using Demucs.
        run_demucs(input_audio, song_dir)

        return {
            "songId": song_id,
            "video": f"/songs/{song_id}/{song_id}.mp4",
            "txt": f"/songs/{song_id}/{song_id}.txt",
            "mp3Vocals": f"/songs/{song_id}/vocals.mp3",
            "mp3Drums": f"/songs/{song_id}/drums.mp3",
            "mp3Bass": f"/songs/{song_id}/bass.mp3",
            "mp3Other": f"/songs/{song_id}/other.mp3",
        }

    except subprocess.CalledProcessError as error:
        shutil.rmtree(song_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Demucs/FFmpeg failed: {error}") from error

    except HTTPException:
        shutil.rmtree(song_dir, ignore_errors=True)
        raise

    except Exception:
        shutil.rmtree(song_dir, ignore_errors=True)
        raise

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


# ============================================================
# DEMUCS
# ============================================================

def run_demucs(input_audio: Path, song_dir: Path) -> None:
    demucs_output = song_dir / "_demucs_raw"
    demucs_output.mkdir(parents=True, exist_ok=True)

    subprocess.run(
        [
            "demucs",
            "-n",
            "htdemucs",
            "-o",
            str(demucs_output),
            "--mp3",
            str(input_audio),
        ],
        check=True,
    )

    stem_dir = demucs_output / "htdemucs" / input_audio.stem

    required_stems = ["vocals", "drums", "bass", "other"]

    for stem_name in required_stems:
        source = stem_dir / f"{stem_name}.mp3"
        destination = song_dir / f"{stem_name}.mp3"

        if not source.exists():
            raise RuntimeError(f"Demucs did not create {stem_name}.mp3")

        shutil.move(str(source), str(destination))

    shutil.rmtree(demucs_output, ignore_errors=True)


# ============================================================
# PLACEHOLDER VIDEO (only used for the plain-file-upload path)
# ============================================================

def create_placeholder_video(input_audio: Path, output_video: Path) -> None:
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(input_audio),
            "-f",
            "lavfi",
            "-i",
            "color=c=black:s=1280x720:r=30",
            "-map",
            "1:v:0",
            "-t",
            get_audio_duration(input_audio),
            "-an",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(output_video),
        ],
        check=True,
    )


def get_audio_duration(input_audio: Path) -> str:
    result = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(input_audio),
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()