import os
import asyncio
import yt_dlp

class VideoProcessor:
    def __init__(self):
        self.download_dir = "downloads"
        # Ensure directory exists
        os.makedirs(self.download_dir, exist_ok=True)
    
    async def download_video(self, youtube_url: str, job_id: str) -> str:
        """
        Download video from YouTube using yt-dlp
        Returns the path to the downloaded video file
        """
        try:
            # Sanitize job_id for filename
            safe_job_id = "".join(c for c in job_id if c.isalnum() or c in ('-', '_'))
            
            # Set up download options (no format specification - let yt-dlp decide)
            ydl_opts = {
                'outtmpl': os.path.join(self.download_dir, f'{safe_job_id}_%(title)s.%(ext)s'),
                'quiet': False,  # Show progress
                'noplaylist': True,
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
                    print(f"First download attempt failed: {e}")
                    print("Trying fallback with explicit format selection...")
                    
                    # Fallback: try with explicit format selection
                    fallback_opts = ydl_opts.copy()
                    fallback_opts['format'] = 'worst'  # Get the worst quality - more likely to be available
                    
                    with yt_dlp.YoutubeDL(fallback_opts) as ydl:
                        info_dict = ydl.extract_info(youtube_url, download=True)
                        file_name = ydl.prepare_filename(info_dict)
                        print(f"✅ Fallback download complete: {file_name}")
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