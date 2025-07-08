from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
import os
import uuid
import asyncio
from pathlib import Path

from services.video_processor import VideoProcessor
from models.clip_request import ClipRequest, ClipData, DownloadRequest, CreateClipsRequest, VideoInfo

app = FastAPI(title="Clip Scene API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create directories
os.makedirs("downloads", exist_ok=True)
os.makedirs("clips", exist_ok=True)

# Mount static files for downloads
app.mount("/downloads", StaticFiles(directory="clips"), name="downloads")

# Initialize video processor
video_processor = VideoProcessor()

# Store processing jobs
processing_jobs = {}

# Store downloaded videos
downloaded_videos = {}

@app.get("/")
async def root():
    return {"message": "Clip Scene API is running"}

@app.post("/download-video")
async def download_video(request: DownloadRequest, background_tasks: BackgroundTasks):
    """
    Download a YouTube video and store it locally
    """
    try:
        # Generate unique video ID
        video_id = str(uuid.uuid4())
        
        # Validate the request
        if not request.youtube_url:
            raise HTTPException(status_code=400, detail="YouTube URL is required")
        
        # Initialize download status
        downloaded_videos[video_id] = {
            "status": "downloading",
            "current_step": "Starting download...",
            "youtube_url": request.youtube_url,
            "format_id": request.format_id,
            "title": None,
            "file_path": None,
            "file_size": 0,
            "error": None
        }
        
        # Start background download
        background_tasks.add_task(download_video_background, video_id, request.youtube_url, request.format_id)
        
        return {
            "video_id": video_id,
            "status": "started",
            "message": "Video download started"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/video/{video_id}")
async def get_video_status(video_id: str):
    """
    Get the status of a video download
    """
    if video_id not in downloaded_videos:
        raise HTTPException(status_code=404, detail="Video not found")
    
    return downloaded_videos[video_id]

@app.get("/videos")
async def list_videos():
    """
    List all downloaded videos
    """
    videos = []
    for video_id, info in downloaded_videos.items():
        if info["status"] == "completed":
            videos.append({
                "video_id": video_id,
                "title": info["title"],
                "file_size": info["file_size"],
                "youtube_url": info["youtube_url"]
            })
    return {"videos": videos}

@app.post("/video-formats")
async def get_video_formats(request: DownloadRequest):
    """
    Get available video formats for a YouTube URL
    """
    try:
        if not request.youtube_url:
            raise HTTPException(status_code=400, detail="YouTube URL is required")
        
        formats = await video_processor.list_available_formats(request.youtube_url)
        
        # Filter and format the results for frontend
        quality_options = []
        
        # First, group formats by resolution and find best quality MP4 for each
        resolution_groups = {}
        
        for fmt in formats:
            vcodec = fmt['vcodec']
            acodec = fmt['acodec']
            has_video = vcodec != 'none'
            ext = fmt['ext']
            
            # Accept only MP4 formats with video
            if has_video and fmt['resolution'] and fmt['resolution'] != 'audio only' and ext == 'mp4':
                resolution = fmt['resolution']
                fps = fmt['fps'] or 0
                filesize = fmt['filesize'] or 0
                
                # Use bitrate/filesize as quality indicator, with fps as secondary factor
                quality_score = filesize + (fps * 1000000)  # Bias towards higher fps
                
                if resolution not in resolution_groups:
                    resolution_groups[resolution] = []
                
                resolution_groups[resolution].append({
                    'format': fmt,
                    'quality_score': quality_score,
                    'fps': fps,
                    'filesize': filesize
                })
        
        # Get the best quality format for each resolution
        best_formats = []
        for resolution, format_list in resolution_groups.items():
            # Sort by quality score (highest first)
            format_list.sort(key=lambda x: x['quality_score'], reverse=True)
            best_format = format_list[0]['format']
            best_formats.append(best_format)
        
        # Sort by resolution height (highest first) and take top 4
        def get_resolution_height(fmt):
            resolution = fmt['resolution']
            if 'x' in str(resolution):
                try:
                    return int(resolution.split('x')[1])
                except:
                    return 0
            return 0
        
        best_formats.sort(key=get_resolution_height, reverse=True)
        top_formats = best_formats[:4]  # Keep only top 4
        
        # Convert to frontend format
        for fmt in top_formats:
            resolution = fmt['resolution']
            fps = fmt['fps'] or 'Unknown'
            ext = fmt['ext']
            filesize = fmt['filesize']
            
            # Create a readable quality label
            quality_label = f"{resolution}"
            if fps != 'Unknown' and fps:
                quality_label += f" ({fps}fps)"
            
            # Estimate file size (this will be video-only size, actual download will be larger)
            size_mb = None
            if filesize:
                size_mb = round(filesize / (1024 * 1024), 1)
            
            # Add note about audio merging
            note = fmt['note'] or ''
            note = f"{note} (audio will be merged automatically)".strip()
            
            option = {
                "format_id": fmt['format_id'],
                "quality_label": quality_label,
                "resolution": resolution,
                "fps": fps,
                "ext": ext,
                "filesize_mb": size_mb,
                "note": note
            }
            quality_options.append(option)
        
        return {"formats": quality_options}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/create-clips-from-video")
async def create_clips_from_video(request: CreateClipsRequest, background_tasks: BackgroundTasks):
    """
    Create clips from an already downloaded video
    """
    try:
        # Get video info - either from provided video_id or latest video
        if request.video_id:
            # Check if video exists in downloaded_videos
            if request.video_id not in downloaded_videos:
                raise HTTPException(status_code=404, detail="Video not found")
            
            video_info = downloaded_videos[request.video_id]
            if video_info["status"] != "completed":
                raise HTTPException(status_code=400, detail="Video is not ready")
        else:
            # Use latest video from downloads folder
            latest_video = await video_processor.get_latest_video_from_downloads()
            if not latest_video:
                raise HTTPException(status_code=404, detail="No videos found in downloads folder")
            
            video_info = {
                "title": latest_video["title"],
                "file_path": latest_video["path"],
                "file_size": latest_video["size"],
                "status": "completed"
            }
        
        # Validate clips
        if not request.clips or len(request.clips) == 0:
            raise HTTPException(status_code=400, detail="At least one clip is required")
        
        # Generate unique job ID
        job_id = str(uuid.uuid4())
        
        # Initialize job status
        processing_jobs[job_id] = {
            "status": "processing",
            "current_step": "Starting clip creation...",
            "total_clips": len(request.clips),
            "completed_clips": 0,
            "clips": [],
            "video_id": request.video_id or "latest",
            "error": None
        }
        
        # Start background processing
        background_tasks.add_task(
            create_clips_from_video_background, 
            job_id, 
            video_info["file_path"],
            request.clips
        )
        
        return {
            "job_id": job_id,
            "status": "started",
            "message": f"Creating {len(request.clips)} clips"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/create-clips")
async def create_clips(request: ClipRequest, background_tasks: BackgroundTasks):
    """
    Create video clips from YouTube URL and timestamp data
    """
    try:
        # Generate unique job ID
        job_id = str(uuid.uuid4())
        
        # Validate the request
        if not request.youtube_url:
            raise HTTPException(status_code=400, detail="YouTube URL is required")
        
        if not request.clips or len(request.clips) == 0:
            raise HTTPException(status_code=400, detail="At least one clip is required")
        
        # Initialize job status
        processing_jobs[job_id] = {
            "status": "downloading",
            "current_step": "Starting download...",
            "total_clips": len(request.clips),
            "completed_clips": 0,
            "clips": [],
            "error": None
        }
        
        # Start background processing
        background_tasks.add_task(
            process_clips_background, 
            job_id, 
            request.youtube_url, 
            request.clips
        )
        
        return {
            "job_id": job_id,
            "status": "started",
            "message": f"Processing {len(request.clips)} clips"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/job/{job_id}")
async def get_job_status(job_id: str):
    """
    Get the status of a processing job
    """
    if job_id not in processing_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return processing_jobs[job_id]

@app.get("/download/{job_id}")
async def download_clips(job_id: str):
    """
    Download all clips as a zip file
    """
    if job_id not in processing_jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = processing_jobs[job_id]
    if job["status"] != "completed":
        raise HTTPException(status_code=400, detail="Job not completed yet")
    
    # Create zip file with all clips
    zip_path = await video_processor.create_zip_archive(job_id, job["clips"])
    
    return FileResponse(
        zip_path,
        media_type="application/zip",
        filename=f"clips_{job_id}.zip"
    )

@app.get("/latest-video")
async def get_latest_video():
    """
    Get the latest video from downloads folder
    """
    try:
        latest_video = await video_processor.get_latest_video_from_downloads()
        
        if not latest_video:
            raise HTTPException(status_code=404, detail="No videos found in downloads folder")
        
        return {
            "filename": latest_video["filename"],
            "title": latest_video["title"],
            "size": latest_video["size"],
            "path": latest_video["path"]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/preview-clips")
async def preview_clips(request: CreateClipsRequest):
    """
    Preview clips without actually creating them - for confirmation step
    """
    try:
        # Get the latest video from downloads if no video_id provided
        if not request.video_id:
            latest_video = await video_processor.get_latest_video_from_downloads()
            if not latest_video:
                raise HTTPException(status_code=404, detail="No videos found in downloads folder")
            
            video_info = {
                "title": latest_video["title"],
                "file_path": latest_video["path"],
                "file_size": latest_video["size"]
            }
        else:
            # Check if video exists in downloaded_videos
            if request.video_id not in downloaded_videos:
                raise HTTPException(status_code=404, detail="Video not found")
            
            video_info = downloaded_videos[request.video_id]
            if video_info["status"] != "completed":
                raise HTTPException(status_code=400, detail="Video is not ready")
        
        # Validate clips
        if not request.clips or len(request.clips) == 0:
            raise HTTPException(status_code=400, detail="At least one clip is required")
        
        # Return preview information
        clips_preview = []
        for i, clip in enumerate(request.clips):
            clips_preview.append({
                "index": i,
                "title": clip.title or f"Clip {i + 1}",
                "start_time": clip.start_time,
                "end_time": clip.end_time,
                "duration": calculate_clip_duration(clip.start_time, clip.end_time)
            })
        
        return {
            "video": {
                "title": video_info.get("title", "Unknown"),
                "file_path": video_info.get("file_path"),
                "file_size": video_info.get("file_size", 0)
            },
            "clips": clips_preview,
            "total_clips": len(clips_preview)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def calculate_clip_duration(start_time: str, end_time: str) -> str:
    """
    Calculate duration between start and end time
    """
    try:
        def time_to_seconds(time_str):
            parts = time_str.split(':')
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
        
        start_seconds = time_to_seconds(start_time)
        end_seconds = time_to_seconds(end_time)
        duration_seconds = end_seconds - start_seconds
        
        hours = duration_seconds // 3600
        minutes = (duration_seconds % 3600) // 60
        seconds = duration_seconds % 60
        
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    except:
        return "00:00:00"

async def download_video_background(video_id: str, youtube_url: str, format_id: str = None):
    """
    Background task to download a video
    """
    try:
        video_info = downloaded_videos[video_id]
        
        # Update status
        if format_id:
            video_info["current_step"] = f"Downloading YouTube video (format: {format_id})..."
        else:
            video_info["current_step"] = "Downloading YouTube video (auto quality)..."
        
        # Download the video
        video_path = await video_processor.download_video(youtube_url, video_id, format_id)
        
        # Get file info
        file_size = os.path.getsize(video_path) if os.path.exists(video_path) else 0
        
        # Extract title from filename
        filename = os.path.basename(video_path)
        title = filename.replace(f"{video_id}_", "").replace(".mp4", "").replace(".webm", "")
        
        # Update video info
        video_info["status"] = "completed"
        video_info["current_step"] = "Download completed!"
        video_info["title"] = title
        video_info["file_path"] = video_path
        video_info["file_size"] = file_size
        
    except Exception as e:
        downloaded_videos[video_id]["status"] = "error"
        downloaded_videos[video_id]["error"] = str(e)
        print(f"Error downloading video {video_id}: {e}")

async def create_clips_from_video_background(job_id: str, video_path: str, clips: List[ClipData]):
    """
    Background task to create clips from an already downloaded video
    """
    try:
        job = processing_jobs[job_id]
        
        # Process each clip
        for i, clip in enumerate(clips):
            try:
                job["current_step"] = f"Creating clip {i + 1} of {len(clips)}: {clip.title or f'Clip {i + 1}'}"
                
                clip_path = await video_processor.create_clip(
                    video_path, 
                    clip.start_time, 
                    clip.end_time, 
                    job_id, 
                    i,
                    clip.title
                )
                
                job["clips"].append({
                    "index": i,
                    "title": clip.title or f"Clip {i + 1}",
                    "start_time": clip.start_time,
                    "end_time": clip.end_time,
                    "file_path": clip_path,
                    "file_size": os.path.getsize(clip_path)
                })
                
                job["completed_clips"] += 1
                
            except Exception as e:
                print(f"Error processing clip {i}: {e}")
                # Continue with other clips
        
        # Mark job as completed
        job["status"] = "completed"
        job["current_step"] = "All clips created successfully!"
        
    except Exception as e:
        processing_jobs[job_id]["status"] = "error"
        processing_jobs[job_id]["error"] = str(e)
        print(f"Error in background processing: {e}")

async def process_clips_background(job_id: str, youtube_url: str, clips: List[ClipData]):
    """
    Background task to process video clips (legacy endpoint)
    """
    try:
        job = processing_jobs[job_id]
        
        # Update status to downloading
        job["current_step"] = "Downloading YouTube video..."
        
        # Download the video first
        video_path = await video_processor.download_video(youtube_url, job_id)
        
        # Update status to clipping
        job["status"] = "processing"
        job["current_step"] = "Creating clips..."
        
        # Process each clip
        for i, clip in enumerate(clips):
            try:
                job["current_step"] = f"Creating clip {i + 1} of {len(clips)}: {clip.title or f'Clip {i + 1}'}"
                
                clip_path = await video_processor.create_clip(
                    video_path, 
                    clip.start_time, 
                    clip.end_time, 
                    job_id, 
                    i,
                    clip.title
                )
                
                job["clips"].append({
                    "index": i,
                    "title": clip.title or f"Clip {i + 1}",
                    "start_time": clip.start_time,
                    "end_time": clip.end_time,
                    "file_path": clip_path,
                    "file_size": os.path.getsize(clip_path)
                })
                
                job["completed_clips"] += 1
                
            except Exception as e:
                print(f"Error processing clip {i}: {e}")
                # Continue with other clips
        
        # Mark job as completed
        job["status"] = "completed"
        job["current_step"] = "All clips created successfully!"
        
        # Clean up original video file
        if os.path.exists(video_path):
            os.remove(video_path)
            
    except Exception as e:
        processing_jobs[job_id]["status"] = "error"
        processing_jobs[job_id]["error"] = str(e)
        print(f"Error in background processing: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 