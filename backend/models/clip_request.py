from pydantic import BaseModel, HttpUrl
from typing import List, Optional

class ClipData(BaseModel):
    title: Optional[str] = None
    start_time: str  # Format: "hh:mm:ss"
    end_time: str    # Format: "hh:mm:ss"

class ClipRequest(BaseModel):
    youtube_url: str
    clips: List[ClipData]

# New models for separated workflow
class DownloadRequest(BaseModel):
    youtube_url: str
    format_id: Optional[str] = None  # Specific format ID for quality selection

class CreateClipsRequest(BaseModel):
    video_id: Optional[str] = None  # ID of the downloaded video (optional - uses latest if not provided)
    clips: List[ClipData]

class VideoInfo(BaseModel):
    video_id: str
    title: str
    duration: Optional[str] = None
    file_size: int
    file_path: str
    status: str

class ClipResponse(BaseModel):
    index: int
    title: str
    start_time: str
    end_time: str
    file_path: str
    file_size: int

class JobStatusResponse(BaseModel):
    status: str  # "processing", "completed", "error"
    total_clips: int
    completed_clips: int
    clips: List[ClipResponse]
    error: Optional[str] = None 