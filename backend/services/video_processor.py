import os
import asyncio
import yt_dlp

class VideoProcessor:
    def __init__(self):
        self.download_dir = "downloads"
        # Ensure directory exists
        os.makedirs(self.download_dir, exist_ok=True)
    
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
                    formats = info_dict.get('formats', [])
                    
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
    
    async def download_video(self, youtube_url: str, job_id: str, format_id: str = None) -> str:
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
                print(f"Downloading video with specific format: {format_id}")
                ydl_opts = {
                    'format': f'{format_id}+bestaudio/best',  # Merge with best audio
                    'outtmpl': os.path.join(self.download_dir, f'{safe_job_id}_%(title)s.%(ext)s'),
                    'quiet': False,  # Show progress
                    'noplaylist': True,
                    # Prefer mp4 for better compatibility
                    'merge_output_format': 'mp4',
                }
            else:
                # Use automatic best quality selection
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
                    'quiet': False,  # Show progress
                    'noplaylist': True,
                    # Prefer mp4 for better compatibility
                    'merge_output_format': 'mp4',
                    # Ensure we get good quality audio
                    'postprocessors': [{
                        'key': 'FFmpegVideoConvertor',
                        'preferedformat': 'mp4',
                    }],
                    # Download metadata
                    'writeinfojson': False,
                    'writethumbnail': False,
                }
            
            print(f"Downloading video from: {youtube_url}")
            
            # Download function to run in executor
            def download_video_sync():
                try:
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        info_dict = ydl.extract_info(youtube_url, download=True)
                        file_name = ydl.prepare_filename(info_dict)
                        print(f"✅ Download complete: {file_name}")
                        return file_name
                except Exception as e:
                    print(f"High-quality download attempt failed: {e}")
                    print("Trying fallback with simpler format selection...")
                    
                    # Fallback: try with simpler format selection
                    fallback_opts = ydl_opts.copy()
                    fallback_opts['format'] = 'best[ext=mp4]/best'  # Simple best format, prefer mp4
                    # Remove postprocessors that might cause issues
                    fallback_opts.pop('postprocessors', None)
                    fallback_opts.pop('merge_output_format', None)
                    
                    try:
                        with yt_dlp.YoutubeDL(fallback_opts) as ydl:
                            info_dict = ydl.extract_info(youtube_url, download=True)
                            file_name = ydl.prepare_filename(info_dict)
                            print(f"✅ Fallback download complete: {file_name}")
                            return file_name
                    except Exception as e2:
                        print(f"Fallback download also failed: {e2}")
                        print("Trying final fallback with worst quality...")
                        
                        # Final fallback: get any available format
                        final_opts = {
                            'format': 'worst',
                            'outtmpl': os.path.join(self.download_dir, f'{safe_job_id}_%(title)s.%(ext)s'),
                            'quiet': False,
                            'noplaylist': True,
                        }
                        
                        with yt_dlp.YoutubeDL(final_opts) as ydl:
                            info_dict = ydl.extract_info(youtube_url, download=True)
                            file_name = ydl.prepare_filename(info_dict)
                            print(f"✅ Final fallback download complete: {file_name}")
                            return file_name
            
            # Run download in executor (async)
            file_path = await asyncio.get_event_loop().run_in_executor(None, download_video_sync)
            
            # Verify file exists
            if os.path.exists(file_path):
                print(f"✅ Verified downloaded file: {file_path}")
                return file_path
            else:
                # Search for the file in case filename differs
                for filename in os.listdir(self.download_dir):
                    if filename.startswith(safe_job_id):
                        found_path = os.path.join(self.download_dir, filename)
                        print(f"✅ Found downloaded file: {found_path}")
                        return found_path
                
                raise Exception(f"Downloaded file not found. Expected: {file_path}")
                
        except Exception as e:
            raise Exception(f"Failed to download video: {str(e)}") 