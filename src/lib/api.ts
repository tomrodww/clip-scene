export interface ClipData {
  title?: string;
  start_time: string;
  end_time: string;
}

export interface ClipRequest {
  youtube_url: string;
  clips: ClipData[];
}

export interface JobStatus {
  status: 'downloading' | 'processing' | 'completed' | 'error';
  current_step?: string;
  total_clips: number;
  completed_clips: number;
  clips: ProcessedClip[];
  error?: string;
}

export interface ProcessedClip {
  index: number;
  title: string;
  start_time: string;
  end_time: string;
  file_path: string;
  file_size: number;
}

export interface CreateClipsResponse {
  job_id: string;
  status: string;
  message: string;
}

export interface DownloadRequest {
  youtube_url: string;
  format_id?: string;  // Optional format ID for quality selection
}

export interface DownloadResponse {
  video_id: string;
  status: string;
  message: string;
}

export interface VideoInfo {
  video_id: string;
  title: string;
  file_size: number;
  youtube_url: string;
}

export interface VideoStatus {
  status: 'downloading' | 'completed' | 'error';
  current_step?: string;
  youtube_url: string;
  title?: string;
  file_path?: string;
  file_size: number;
  error?: string;
}

export interface CreateClipsFromVideoRequest {
  video_id: string;
  clips: ClipData[];
}

export interface VideoFormat {
  format_id: string;
  quality_label: string;
  resolution: string;
  fps: string | number;
  ext: string;
  filesize_mb?: number;
  note?: string;
}

export interface VideoFormatsResponse {
  formats: VideoFormat[];
}

const API_BASE = 'http://localhost:8000';

export class ClipSceneAPI {
  // New separated workflow methods
  static async downloadVideo(request: DownloadRequest): Promise<DownloadResponse> {
    const response = await fetch(`${API_BASE}/download-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to download video');
    }

    return response.json();
  }

  static async getVideoStatus(videoId: string): Promise<VideoStatus> {
    const response = await fetch(`${API_BASE}/video/${videoId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get video status');
    }

    return response.json();
  }

  static async listVideos(): Promise<{ videos: VideoInfo[] }> {
    const response = await fetch(`${API_BASE}/videos`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to list videos');
    }

    return response.json();
  }

  static async createClipsFromVideo(request: CreateClipsFromVideoRequest): Promise<CreateClipsResponse> {
    const response = await fetch(`${API_BASE}/create-clips-from-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create clips');
    }

    return response.json();
  }

  static async pollVideoStatus(
    videoId: string,
    onUpdate: (status: VideoStatus) => void,
    intervalMs: number = 2000
  ): Promise<VideoStatus> {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const status = await this.getVideoStatus(videoId);
          onUpdate(status);

          if (status.status === 'completed') {
            resolve(status);
          } else if (status.status === 'error') {
            reject(new Error(status.error || 'Download failed'));
          } else {
            setTimeout(poll, intervalMs);
          }
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  }

  // Legacy methods (keep for backward compatibility)
  static async createClips(request: ClipRequest): Promise<CreateClipsResponse> {
    const response = await fetch(`${API_BASE}/create-clips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create clips');
    }

    return response.json();
  }

  static async getJobStatus(jobId: string): Promise<JobStatus> {
    const response = await fetch(`${API_BASE}/job/${jobId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get job status');
    }

    return response.json();
  }

  static getDownloadUrl(jobId: string): string {
    return `${API_BASE}/download/${jobId}`;
  }

  static async pollJobStatus(
    jobId: string,
    onUpdate: (status: JobStatus) => void,
    intervalMs: number = 2000
  ): Promise<JobStatus> {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const status = await this.getJobStatus(jobId);
          onUpdate(status);

          if (status.status === 'completed') {
            resolve(status);
          } else if (status.status === 'error') {
            reject(new Error(status.error || 'Processing failed'));
          } else {
            setTimeout(poll, intervalMs);
          }
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  }

  // New format-related methods
  static async getVideoFormats(request: { youtube_url: string }): Promise<VideoFormatsResponse> {
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
} 