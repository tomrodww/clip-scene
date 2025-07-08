from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
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

@app.post("/download-and-create-clips")
async def download_and_create_clips(request: ClipRequest, background_tasks: BackgroundTasks):
    """
    Unified endpoint: Download video and create clips in one step
    """
    try:
        # Generate unique job ID
        job_id = str(uuid.uuid4())
        
        # Validate the request
        if not request.youtube_url:
            raise HTTPException(status_code=400, detail="YouTube URL is required")
        
        if not request.clips or len(request.clips) == 0:
            raise HTTPException(status_code=400, detail="At least one clip is required")
        
        # Initialize job status for unified process
        processing_jobs[job_id] = {
            "status": "downloading",
            "current_step": "Starting video download...",
            "total_clips": len(request.clips),
            "completed_clips": 0,
            "clips": [],
            "video_id": None,
            "error": None,
            "progress_percentage": 0
        }
        
        # Start unified background processing
        background_tasks.add_task(
            download_and_create_clips_background, 
            job_id, 
            request.youtube_url, 
            request.clips
        )
        
        return {
            "job_id": job_id,
            "status": "started",
            "message": f"Starting download and creation of {len(request.clips)} clips"
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

async def download_and_create_clips_background(job_id: str, youtube_url: str, clips: List[ClipData]):
    """
    Unified background task: Download video, create clips, delete original video
    """
    try:
        job = processing_jobs[job_id]
        
        # Step 1: Download Video
        job["current_step"] = "Downloading video from YouTube..."
        job["progress_percentage"] = 10
        
        # Generate unique video ID for download
        video_id = str(uuid.uuid4())
        
        try:
            video_path = await video_processor.download_video(youtube_url, video_id)
            job["current_step"] = "Video download completed"
            job["progress_percentage"] = 30
            job["video_id"] = video_id
        except Exception as e:
            job["status"] = "error"
            job["error"] = f"Failed to download video: {str(e)}"
            job["current_step"] = "Download failed"
            return
        
        # Step 2: Create Clips
        job["current_step"] = "Starting clip creation..."
        job["status"] = "processing"
        job["progress_percentage"] = 40
        
        # Process each clip
        for i, clip in enumerate(clips):
            try:
                job["current_step"] = f"Creating clip {i + 1} of {len(clips)}: {clip.title or f'Clip {i + 1}'}"
                job["progress_percentage"] = 40 + (i / len(clips)) * 50  # 40-90% for clip creation
                
                clip_path = await video_processor.create_clip(
                    video_path, 
                    clip.start_time, 
                    clip.end_time, 
                    job_id, 
                    i,
                    clip.title or f"Clip {i + 1}"
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
                job["status"] = "error"
                job["error"] = f"Failed to create clip {i + 1}: {str(e)}"
                job["current_step"] = f"Failed creating clip {i + 1}"
                return
        
        # Step 3: Delete Original Video
        job["current_step"] = "Cleaning up: deleting original video..."
        job["progress_percentage"] = 95
        
        try:
            if os.path.exists(video_path):
                os.remove(video_path)
                job["current_step"] = "Original video deleted successfully"
            else:
                job["current_step"] = "Original video already removed"
        except Exception as e:
            # Don't fail the entire process if we can't delete the original
            job["current_step"] = f"Warning: Could not delete original video: {str(e)}"
        
        # Step 4: Complete
        job["status"] = "completed"
        job["current_step"] = f"Process completed! Created {len(job['clips'])} clips"
        job["progress_percentage"] = 100
        
        # Clean up video tracking if it was added to downloaded_videos
        if video_id in downloaded_videos:
            del downloaded_videos[video_id]
        
    except Exception as e:
        processing_jobs[job_id]["status"] = "error"
        processing_jobs[job_id]["error"] = str(e)
        processing_jobs[job_id]["current_step"] = f"Process failed: {str(e)}"
        # Error already tracked in job status, no need for console output

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000, 
        access_log=False  # Suppress access logs (HTTP request logs)
    ) 