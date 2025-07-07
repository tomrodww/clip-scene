export interface ClipData {
  id: string;
  startTime: string;
  endTime: string;
  title?: string;
}

export interface FormData {
  youtubeUrl: string;
  clips: ClipData[];
} 