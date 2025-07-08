import { useState } from 'react';
import { Play, Download, Clock, FileVideo, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ClipsPreviewResponse } from '@/lib/api';

interface ClipsPreviewProps {
  previewData: ClipsPreviewResponse;
  onDownloadClips: () => void;
  onCancel: () => void;
  isDownloading: boolean;
}

export default function ClipsPreview({ 
  previewData, 
  onDownloadClips, 
  onCancel, 
  isDownloading 
}: ClipsPreviewProps) {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const calculateTotalDuration = () => {
    let totalSeconds = 0;
    previewData.clips.forEach(clip => {
      const [hours, minutes, seconds] = clip.duration.split(':').map(Number);
      totalSeconds += hours * 3600 + minutes * 60 + seconds;
    });
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 p-6 border border-theme-border-primary rounded-lg force-dark-bg">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold force-orange-text">Clips Preview</h2>
        <p className="text-theme-text-muted">
          Review your video and clips before creating them
        </p>
      </div>

      {/* Video Information */}
      <div className="border border-theme-border-primary rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileVideo className="h-5 w-5 force-orange" />
          <h3 className="font-semibold force-white-text">Source Video</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-theme-text-muted">Title:</span>
            <div className="font-medium force-white-text mt-1">{previewData.video.title}</div>
          </div>
          
          <div>
            <span className="text-theme-text-muted">File Size:</span>
            <div className="font-medium force-white-text mt-1">
              {formatFileSize(previewData.video.file_size)}
            </div>
          </div>
        </div>
      </div>

      {/* Clips Summary */}
      <div className="border border-theme-border-primary rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 force-orange" />
            <h3 className="font-semibold force-white-text">Clips to Create</h3>
          </div>
          <div className="text-sm text-theme-text-muted">
            {previewData.total_clips} clips • {calculateTotalDuration()} total duration
          </div>
        </div>

        <div className="space-y-2 max-h-60 overflow-y-auto">
          {previewData.clips.map((clip, index) => (
            <div 
              key={index}
              className="flex items-center justify-between p-3 border border-gray-600 rounded-lg bg-gray-800/50"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full force-orange flex items-center justify-center text-black font-bold text-sm">
                  {index + 1}
                </div>
                <div>
                  <div className="font-medium force-white-text">
                    {clip.title}
                  </div>
                  <div className="text-xs text-theme-text-muted">
                    {clip.start_time} → {clip.end_time}
                  </div>
                </div>
              </div>
              
              <div className="text-sm force-white-text font-mono">
                {clip.duration}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={isDownloading}
          className={cn(
            "flex-1 py-3 px-6 rounded-lg font-bold text-lg",
            "bg-gray-600 text-white border-2 border-gray-500",
            "hover:bg-gray-500 hover:border-gray-400 hover:cursor-pointer",
            "transition-all duration-200",
            "focus:ring-2 focus:ring-gray-500 focus:ring-offset-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "flex items-center justify-center gap-2"
          )}
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={onDownloadClips}
          disabled={isDownloading}
          className={cn(
            "flex-1 py-3 px-6 rounded-lg font-bold text-lg force-orange text-black",
            "hover:bg-orange-600 hover:cursor-pointer",
            "transition-all duration-200",
            "focus:ring-2 focus:ring-orange-500 focus:ring-offset-2",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-600 disabled:text-gray-800",
            "flex items-center justify-center gap-2"
          )}
        >
          {isDownloading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating Clips...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Download Clips
            </>
          )}
        </button>
      </div>
    </div>
  );
} 