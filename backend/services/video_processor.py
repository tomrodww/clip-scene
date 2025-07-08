import os
import asyncio
import yt_dlp
import subprocess
import logging

class VideoProcessor:
    def __init__(self):
        self.download_dir = "downloads"
        self.clips_dir = "clips"
        
        # Ensure directories exist
        os.makedirs(self.download_dir, exist_ok=True)
        os.makedirs(self.clips_dir, exist_ok=True)

    def _get_yt_dlp_logger(self):
        """Custom logger to suppress noisy YouTube output and keep only essential info"""
        class CustomLogger:
            def debug(self, msg):
                # Suppress all debug messages
                pass
            
            def info(self, msg):
                # Only show download progress and essential info
                if any(keyword in msg for keyword in ['Downloading', 'Merging', 'Converting']):
                    # Show simplified download progress
                    if 'Downloading' in msg and '%' in msg:
                        # Extract just the percentage for progress
                        if 'ETA' in msg:
                            parts = msg.split()
                            for i, part in enumerate(parts):
                                if '%' in part:
                                    print(f"📥 Download progress: {part}")
                                    break
                    elif 'Merging' in msg:
                        print("🔄 Merging video and audio...")
                    elif 'Converting' in msg:
                        print("🔄 Converting video format...")
            
            def warning(self, msg):
                # Suppress YouTube signature warnings and other noise
                pass
            
            def error(self, msg):
                print(f"❌ Download error: {msg}")
        
        return CustomLogger()
    
    async def create_clip(self, video_path: str, start_time: str, end_time: str, job_id: str, clip_index: int, title: str | None = None) -> str:
        """
        Create a video clip using ffmpeg
        
        Args:
            video_path: Path to the source video file
            start_time: Start time in format "hh:mm:ss"
            end_time: End time in format "hh:mm:ss"
            job_id: Unique job identifier
            clip_index: Index of the clip
            title: Optional title for the clip
            
        Returns:
            Path to the created clip file
        """
        try:
            # Sanitize job_id and title for filename
            safe_job_id = "".join(c for c in job_id if c.isalnum() or c in ('-', '_'))
            
            # Create output filename
            if title:
                safe_title = "".join(c for c in title if c.isalnum() or c in (' ', '-', '_')).strip().replace(' ', '-')
                output_filename = f"{safe_title}_{safe_job_id}_clip_{clip_index + 1}.mp4"
            else:
                output_filename = f"{safe_job_id}_clip_{clip_index + 1}.mp4"
            output_path = os.path.join(self.clips_dir, output_filename)
            
            # Ensure the source video exists
            if not os.path.exists(video_path):
                raise Exception(f"Source video not found: {video_path}")
            
            # Calculate duration for more efficient processing
            duration_cmd = [
                'ffprobe', '-v', 'quiet', '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1', video_path
            ]
            
            def get_duration_sync():
                try:
                    result = subprocess.run(duration_cmd, capture_output=True, text=True, check=True)
                    return float(result.stdout.strip())
                except:
                    return None
            
            # Get video duration
            video_duration = await asyncio.get_event_loop().run_in_executor(None, get_duration_sync)
            
            # Convert time strings to seconds for validation
            def time_to_seconds(time_str):
                parts = time_str.split(':')
                return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
            
            start_seconds = time_to_seconds(start_time)
            end_seconds = time_to_seconds(end_time)
            
            # Validate time ranges
            if start_seconds >= end_seconds:
                raise Exception(f"Start time ({start_time}) must be before end time ({end_time})")
            
            if video_duration and end_seconds > video_duration:
                raise Exception(f"End time ({end_time}) exceeds video duration ({video_duration:.2f}s)")
            
            # Build ffmpeg command
            # Using fast and high-quality settings
            cmd = [
                'ffmpeg',
                '-ss', start_time,  # Start time (seeking before input for efficiency)
                '-i', video_path,   # Input file
                '-t', str(end_seconds - start_seconds),  # Duration
                '-c:v', 'libx264',  # Video codec
                '-c:a', 'aac',      # Audio codec
                '-preset', 'fast',  # Encoding speed
                '-crf', '23',       # Quality level (lower = better quality)
                '-avoid_negative_ts', 'make_zero',  # Handle timestamp issues
                '-y',               # Overwrite output file
                output_path
            ]
            
            print(f"✂️ Creating clip: {output_filename}")
            
            # Execute ffmpeg command in executor
            def run_ffmpeg_sync():
                try:
                    result = subprocess.run(
                        cmd, 
                        capture_output=True, 
                        text=True, 
                        check=True,
                        timeout=300  # 5 minute timeout
                    )
                    return result
                except subprocess.CalledProcessError as e:
                    raise Exception(f"FFmpeg failed: {e.stderr}")
                except subprocess.TimeoutExpired:
                    raise Exception("FFmpeg timeout: clip creation took too long")
            
            # Run ffmpeg
            await asyncio.get_event_loop().run_in_executor(None, run_ffmpeg_sync)
            
            # Verify output file was created
            if not os.path.exists(output_path):
                raise Exception(f"Clip file was not created: {output_path}")
            
            # Verify file size is reasonable
            file_size = os.path.getsize(output_path)
            if file_size < 1024:  # Less than 1KB is suspicious
                raise Exception(f"Created clip file seems too small: {file_size} bytes")
            
            # Format file size for display
            if file_size > 1024 * 1024:
                size_str = f"{file_size / (1024 * 1024):.1f}MB"
            else:
                size_str = f"{file_size / 1024:.1f}KB"
            
            print(f"✅ Clip created: {output_filename} ({size_str})")
            return output_path
            
        except Exception as e:
            # Clean up partial file if it exists
            if 'output_path' in locals() and os.path.exists(output_path):
                try:
                    os.remove(output_path)
                except:
                    pass
            raise Exception(f"Failed to create clip: {str(e)}")

    async def get_latest_video_from_downloads(self) -> dict | None:
        """
        Get the most recently downloaded video from the downloads folder
        """
        try:
            # List all files in downloads directory
            download_files = []
            for filename in os.listdir(self.download_dir):
                file_path = os.path.join(self.download_dir, filename)
                if os.path.isfile(file_path) and filename.endswith(('.mp4', '.webm', '.mkv')):
                    # Get file stats
                    stat = os.stat(file_path)
                    download_files.append({
                        'filename': filename,
                        'path': file_path,
                        'size': stat.st_size,
                        'modified_time': stat.st_mtime
                    })
            
            if not download_files:
                return None
            
            # Sort by modification time (newest first)
            download_files.sort(key=lambda x: x['modified_time'], reverse=True)
            latest_file = download_files[0]
            
            # Extract title from filename (remove UUID prefix if present)
            title = latest_file['filename']
            if '_' in title:
                # Remove UUID prefix and file extension
                title_part = title.split('_', 1)[1] if len(title.split('_', 1)) > 1 else title
                title = os.path.splitext(title_part)[0]
            else:
                title = os.path.splitext(title)[0]
            
            return {
                'filename': latest_file['filename'],
                'path': latest_file['path'],
                'title': title,
                'size': latest_file['size'],
                'modified_time': latest_file['modified_time']
            }
            
        except Exception as e:
            raise Exception(f"Failed to get latest video: {str(e)}")
    
    async def list_available_formats(self, youtube_url: str):
        """
        List all available formats for a YouTube video
        """
        try:
            ydl_opts = {
                'quiet': True,
                'no_warnings': True,
                'listformats': True,
            }
            
            def list_formats_sync():
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    info_dict = ydl.extract_info(youtube_url, download=False)
                    formats = info_dict.get('formats', []) if info_dict else []
                    
                    if len(formats) == 0:
                        return []
                    
                    format_info = []
                    
                    for f in formats:
                        vcodec = f.get('vcodec', 'none')
                        acodec = f.get('acodec', 'none')
                        
                        format_data = {
                            'format_id': f.get('format_id'),
                            'ext': f.get('ext'),
                            'resolution': f.get('resolution'),
                            'fps': f.get('fps'),
                            'vcodec': vcodec,
                            'acodec': acodec,
                            'filesize': f.get('filesize'),
                            'note': f.get('format_note')
                        }
                        
                        format_info.append(format_data)
                    
                    return format_info
            
            result = await asyncio.get_event_loop().run_in_executor(None, list_formats_sync)
            return result
            
        except Exception as e:
            print(f"Error listing formats: {e}")
            return []
    
    async def download_video(self, youtube_url: str, job_id: str, format_id: str | None = None) -> str:
        """
        Download video from YouTube using yt-dlp
        Returns the path to the downloaded video file
        """
        try:
            # Sanitize job_id for filename
            safe_job_id = "".join(c for c in job_id if c.isalnum() or c in ('-', '_'))
            
            # Set up download options
            if format_id:
                # Use specific format if provided (video-only will be merged with best audio)
                print(f"📥 Starting download with format: {format_id}")
                ydl_opts = {
                    'format': f'{format_id}+bestaudio/best',  # Merge with best audio
                    'outtmpl': os.path.join(self.download_dir, f'{safe_job_id}_%(title)s.%(ext)s'),
                    'quiet': True,  # Suppress most output
                    'noplaylist': True,
                    # Prefer mp4 for better compatibility
                    'merge_output_format': 'mp4',
                    # Use custom logger to suppress noisy warnings
                    'logger': self._get_yt_dlp_logger(),
                }
            else:
                # Use automatic best quality selection
                print("📥 Starting download with best available quality...")
                ydl_opts = {
                    # Format selection: prioritize highest quality video+audio
                    'format': (
                        # First try: Best video+audio in single file (up to 4K)
                        'bestvideo[height<=2160]+bestaudio/best[height<=2160]/'
                        # Fallback: Best video+audio in single file (up to 1440p)
                        'bestvideo[height<=1440]+bestaudio/best[height<=1440]/'
                        # Fallback: Best video+audio in single file (up to 1080p)
                        'bestvideo[height<=1080]+bestaudio/best[height<=1080]/'
                        # Fallback: Best video+audio in single file (up to 720p)
                        'bestvideo[height<=720]+bestaudio/best[height<=720]/'
                        # Final fallback: Best available
                        'best'
                    ),
                    'outtmpl': os.path.join(self.download_dir, f'{safe_job_id}_%(title)s.%(ext)s'),
                    'quiet': True,  # Suppress most output
                    'noplaylist': True,
                    # Prefer mp4 for better compatibility
                    'merge_output_format': 'mp4',
                    # Use custom logger to suppress noisy warnings
                    'logger': self._get_yt_dlp_logger(),
                    # Ensure we get good quality audio
                    'postprocessors': [{
                        'key': 'FFmpegVideoConvertor',
                        'preferedformat': 'mp4',
                    }],
                    # Download metadata
                    'writeinfojson': False,
                    'writethumbnail': False,
                }
            
            # Download function to run in executor
            def download_video_sync():
                try:
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        info_dict = ydl.extract_info(youtube_url, download=True)
                        file_name = ydl.prepare_filename(info_dict)
                        return file_name
                except Exception as e:
                    print("⚠️ Primary download failed, trying fallback...")
                    
                    # Fallback: try with simpler format selection
                    fallback_opts = ydl_opts.copy()
                    fallback_opts['format'] = 'best[ext=mp4]/best'  # Simple best format, prefer mp4
                    # Remove postprocessors that might cause issues
                    fallback_opts.pop('postprocessors', None)
                    fallback_opts.pop('merge_output_format', None)
                    # Keep custom logger
                    fallback_opts['logger'] = self._get_yt_dlp_logger()
                    
                    try:
                        with yt_dlp.YoutubeDL(fallback_opts) as ydl:
                            info_dict = ydl.extract_info(youtube_url, download=True)
                            file_name = ydl.prepare_filename(info_dict)
                            return file_name
                    except Exception as e2:
                        print("⚠️ Fallback failed, trying minimal download...")
                        
                        # Final fallback: get any available format
                        final_opts = {
                            'format': 'worst',
                            'outtmpl': os.path.join(self.download_dir, f'{safe_job_id}_%(title)s.%(ext)s'),
                            'quiet': True,
                            'noplaylist': True,
                            'logger': self._get_yt_dlp_logger(),
                        }
                        
                        with yt_dlp.YoutubeDL(final_opts) as ydl:
                            info_dict = ydl.extract_info(youtube_url, download=True)
                            file_name = ydl.prepare_filename(info_dict)
                            return file_name
            
            # Run download in executor (async)
            file_path = await asyncio.get_event_loop().run_in_executor(None, download_video_sync)
            
            # Verify file exists
            if os.path.exists(file_path):
                # Get file size for display
                file_size = os.path.getsize(file_path)
                if file_size > 1024 * 1024:
                    size_str = f"{file_size / (1024 * 1024):.1f}MB"
                else:
                    size_str = f"{file_size / 1024:.1f}KB"
                
                # Extract title from filename for display
                filename = os.path.basename(file_path)
                if '_' in filename:
                    title_part = filename.split('_', 1)[1] if len(filename.split('_', 1)) > 1 else filename
                    title = os.path.splitext(title_part)[0]
                else:
                    title = os.path.splitext(filename)[0]
                
                print(f"✅ Download complete: {title} ({size_str})")
                return file_path
            else:
                # Search for the file in case filename differs
                for filename in os.listdir(self.download_dir):
                    if filename.startswith(safe_job_id):
                        found_path = os.path.join(self.download_dir, filename)
                        
                        # Get file size for display
                        file_size = os.path.getsize(found_path)
                        if file_size > 1024 * 1024:
                            size_str = f"{file_size / (1024 * 1024):.1f}MB"
                        else:
                            size_str = f"{file_size / 1024:.1f}KB"
                        
                        # Extract title from filename for display
                        if '_' in filename:
                            title_part = filename.split('_', 1)[1] if len(filename.split('_', 1)) > 1 else filename
                            title = os.path.splitext(title_part)[0]
                        else:
                            title = os.path.splitext(filename)[0]
                        
                        print(f"✅ Download complete: {title} ({size_str})")
                        return found_path
                
                raise Exception(f"Downloaded file not found. Expected: {file_path}")
                
        except Exception as e:
            raise Exception(f"Failed to download video: {str(e)}") 