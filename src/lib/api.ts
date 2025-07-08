export interface ClipData {
  title?: string;
  start_time: string;
  end_time: string;
}

export interface ClipRequest {
  youtube_url: string;
  clips: ClipData[];
}

export interface CreateClipsResponse {
  job_id: string;
  status: string;
  message: string;
}

export interface DownloadRequest {
  youtube_url: string;
  format_id?: string;
}

export interface JobStatusWithProgress {
  status: string;
  current_step: string;
  total_clips: number;
  completed_clips: number;
  clips: Array<{
    index: number;
    title: string;
    start_time: string;
    end_time: string;
    file_path: string;
    file_size: number;
  }>;
  video_id?: string;
  error?: string;
  progress_percentage: number;
}

export interface VideoFormat {
  format_id: string;
  quality_label: string;
  resolution: string;
  fps: number | string;
  ext: string;
  filesize_mb?: number;
  note: string;
}

export interface VideoFormatsResponse {
  formats: VideoFormat[];
}

const API_BASE = 'http://localhost:8000';

export class ClipSceneAPI {
  static async getVideoFormats(request: DownloadRequest): Promise<VideoFormatsResponse> {
    const response = await fetch(`${API_BASE}/video-formats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get video formats');
    }

    return response.json();
  }

  static async downloadAndCreateClips(request: ClipRequest): Promise<CreateClipsResponse> {
    const response = await fetch(`${API_BASE}/download-and-create-clips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to start unified process');
    }

    return response.json();
  }

  static async pollUnifiedJobStatus(
    jobId: string, 
    onProgress: (status: JobStatusWithProgress) => void
  ): Promise<JobStatusWithProgress> {
    return new Promise((resolve, reject) => {
      const pollInterval = setInterval(async () => {
        try {
          const response = await fetch(`${API_BASE}/job/${jobId}`);
          
          if (!response.ok) {
            clearInterval(pollInterval);
            reject(new Error('Failed to get job status'));
            return;
          }

          const status: JobStatusWithProgress = await response.json();
          onProgress(status);

          if (status.status === 'completed' || status.status === 'error') {
            clearInterval(pollInterval);
            resolve(status);
          }
        } catch (error) {
          clearInterval(pollInterval);
          reject(error);
        }
      }, 1000); // Poll every second
    });
  }
} 