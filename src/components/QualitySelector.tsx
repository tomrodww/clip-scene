import React from 'react';
import { cn } from '@/lib/utils';
import { isQualityAvailable, QualityOption } from '@/lib/quality-utils';

interface VideoFormat {
  format_id: string;
  quality_label: string;
  resolution: string;
  fps: string | number;
  ext: string;
  filesize_mb?: number;
  note?: string;
}

interface QualitySelectorProps {
  selectedQuality: QualityOption;
  onQualityChange: (quality: QualityOption) => void;
  availableFormats: VideoFormat[];
  isLoadingFormats: boolean;
  youtubeUrl: string;
  isValidYouTubeUrl: (url: string) => boolean;
  downloadStatus: boolean;
}

export const QualitySelector: React.FC<QualitySelectorProps> = ({
  selectedQuality,
  onQualityChange,
  availableFormats,
  isLoadingFormats,
  youtubeUrl,
  isValidYouTubeUrl,
  downloadStatus
}) => {
  return (
    <div className="flex w-full">
      <h3 className="text-lg font-medium text-theme-text-primary w-60">Download Quality:</h3>
      <div className="flex gap-2 w-full">
        {(['720p', '1080p', '1440p', '4K'] as const).map((quality) => {
          const isAvailable = isQualityAvailable(quality, availableFormats);
          
          // Debug logging
          if (availableFormats.length > 0) {
            //console.log(`Quality ${quality}: available=${isAvailable}`);
            //console.log(`Available resolutions:`, availableFormats.map(f => f.resolution));
          }
          
          // Disable if: no URL, invalid URL, currently loading formats, or quality not available (only after formats are loaded)
          const isDisabled = !youtubeUrl.trim() || 
            !isValidYouTubeUrl(youtubeUrl.trim()) || 
            downloadStatus ||
            isLoadingFormats || 
            (availableFormats.length > 0 && !isAvailable);

          return (
            <button
              key={quality}
              type="button"
              onClick={() => !isDisabled && onQualityChange(quality)}
              disabled={isDisabled}
              className={cn(
                "py-1 px-2 h-10 w-24 rounded-lg font-medium text-center transition-all duration-200",
                "border-2",
                isDisabled
                  ? "border-gray-600 bg-gray-800 text-gray-500 cursor-not-allowed opacity-50"
                  : selectedQuality === quality
                    ? "force-orange-border force-orange text-black hover:cursor-pointer"
                    : "border-gray-600 bg-gray-800 force-white-text hover:force-orange-border hover:force-orange-text hover:bg-gray-700 hover:cursor-pointer"
              )}
            >
              {quality}
            </button>
          );
        })}
      </div>
    </div>
  );
}; 