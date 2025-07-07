# Clip Scene Backend

A fast Python backend for creating video clips from YouTube videos using yt-dlp and FFmpeg.

## 🚀 Features

- **YouTube Video Download**: Uses yt-dlp for reliable video downloading
- **Efficient Clipping**: FFmpeg with stream copying (no re-encoding) for fast processing
- **Async Processing**: Background job processing with status tracking
- **Batch Processing**: Create multiple clips from one video
- **ZIP Downloads**: Download all clips as a single ZIP file
- **REST API**: FastAPI-based API with automatic documentation

## 🛠️ Requirements

- **Python 3.8+**
- **FFmpeg** (must be installed and available in PATH)
- **yt-dlp** (installed via pip)

## 📦 Installation

### 1. Clone and Setup

```bash
cd backend
python setup.py
```

The setup script will:
- Check Python version
- Check if FFmpeg is installed
- Install Python dependencies
- Provide FFmpeg installation instructions if needed

### 2. Manual Installation

If you prefer manual setup:

```bash
# Install Python dependencies
pip install -r requirements.txt

# Install FFmpeg (varies by OS)
# Windows: winget install ffmpeg
# macOS: brew install ffmpeg  
# Ubuntu: sudo apt install ffmpeg
```

## 🚦 Running the Server

```bash
# Development mode (with auto-reload)
python main.py

# Or using uvicorn directly
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at: `http://localhost:8000`

## 📡 API Endpoints

### 1. Create Clips Job

**POST** `/create-clips`

Creates a background job to process video clips.

```json
{
  "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "clips": [
    {
      "start_time": "00:00:30",
      "end_time": "00:01:00",
      "title": "Best Part"
    },
    {
      "start_time": "00:02:15",
      "end_time": "00:02:45"
    }
  ]
}
```

**Response:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "started",
  "message": "Processing 2 clips"
}
```

### 2. Check Job Status

**GET** `/job/{job_id}`

Check the status of a processing job.

**Response:**
```json
{
  "status": "completed",
  "total_clips": 2,
  "completed_clips": 2,
  "clips": [
    {
      "index": 0,
      "title": "Best Part",
      "start_time": "00:00:30",
      "end_time": "00:01:00",
      "file_path": "clips/550e8400_000_Best_Part.mp4",
      "file_size": 1024000
    }
  ],
  "error": null
}
```

### 3. Download Clips

**GET** `/download/{job_id}`

Download all clips as a ZIP file.

**Response:** ZIP file download

## 🏗️ Architecture

```
Frontend (Next.js) 
    ↓ HTTP Request
FastAPI Backend
    ↓ Background Job
yt-dlp (Download) 
    ↓ Video File
FFmpeg (Clip Creation)
    ↓ Video Clips
ZIP Archive → Download
```

## 🔧 Technical Details

### Video Processing Pipeline

1. **Download**: yt-dlp downloads the highest quality MP4 video
2. **Clip Creation**: FFmpeg creates clips using stream copying (no re-encoding)
3. **File Management**: Organized storage with job-based naming
4. **Cleanup**: Automatic cleanup of temporary files

### Performance Optimizations

- **Stream Copying**: No video re-encoding for faster processing
- **Async Processing**: Non-blocking background jobs
- **Efficient Formats**: Prefers MP4 for best compatibility
- **Memory Management**: Automatic cleanup of large video files

### File Organization

```
backend/
├── downloads/          # Temporary video downloads
├── clips/             # Generated clips and ZIP files
├── main.py           # FastAPI application
├── models/           # Pydantic models
├── services/         # Video processing logic
└── requirements.txt  # Dependencies
```

## 🔍 API Documentation

Once running, visit:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## 🐛 Troubleshooting

### FFmpeg Not Found
```bash
# Check if FFmpeg is installed
ffmpeg -version

# Install FFmpeg
# Windows: winget install ffmpeg
# macOS: brew install ffmpeg
# Ubuntu: sudo apt install ffmpeg
```

### yt-dlp Download Issues
- Check if the YouTube URL is valid and accessible
- Some videos may be geo-blocked or have download restrictions
- Try updating yt-dlp: `pip install --upgrade yt-dlp`

### Large Video Timeouts
- For very long videos, consider implementing progress callbacks
- Monitor disk space for large downloads
- Adjust timeout settings if needed

## 🤝 Integration with Frontend

The backend is designed to work with the Next.js frontend. Update the frontend's API calls to use these endpoints:

```typescript
// Create clips job
const response = await fetch('http://localhost:8000/create-clips', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ youtube_url, clips })
});

// Check status
const status = await fetch(`http://localhost:8000/job/${jobId}`);

// Download clips
window.open(`http://localhost:8000/download/${jobId}`);
```

## 📝 License

MIT License - see LICENSE file for details. 