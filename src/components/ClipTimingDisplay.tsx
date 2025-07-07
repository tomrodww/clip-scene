import { useState } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatSecondsToTime } from '@/lib/youtube';

interface ClipTimingDisplayProps {
  startTime: number;
  endTime: number;
  isDragging: 'start' | 'end' | 'seek' | null;
  onAddClip: (startTime: string, endTime: string, title?: string) => void;
}

export default function ClipTimingDisplay({ 
  startTime, 
  endTime, 
  isDragging, 
  onAddClip 
}: ClipTimingDisplayProps) {
  const [clipTitle, setClipTitle] = useState('');

  const handleAddClip = () => {
    onAddClip(
      formatSecondsToTime(startTime),
      formatSecondsToTime(endTime),
      clipTitle.trim() || undefined
    );
    setClipTitle(''); // Clear title after adding
  };

  return (
    <div className="space-y-3">
      {/* Clip timing display with add button */}
      <div className="flex justify-between items-center text-sm bg-gray-700 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-600 rounded-full" />
          <span className={cn(
            "font-medium transition-colors",
            isDragging === 'start' ? "text-red-400" : "text-gray-300"
          )}>
            Start: {formatSecondsToTime(startTime)}
          </span>
        </div>
        
        <div className="text-gray-400 text-xs">
          Duration: {formatSecondsToTime(endTime - startTime)}
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-medium transition-colors",
              isDragging === 'end' ? "text-red-400" : "text-gray-300"
            )}>
              End: {formatSecondsToTime(endTime)}
            </span>
            <div className="w-3 h-3 bg-red-600 rounded-full" />
          </div>
          
          
        </div>
      </div>

      {/* Optional clip title input */}
      <div className="flex items-center gap-2 h-10">
        <input
          type="text"
          value={clipTitle}
          onChange={(e) => setClipTitle(e.target.value)}
          placeholder="Clip title (optional)"
          className={cn(
            "w-full px-3 py-2 rounded border border-gray-600",
            "bg-gray-700 text-white text-sm",
            "focus:ring-2 focus:ring-gray-500 focus:border-transparent",
            "placeholder-gray-400"
          )}
        />
        <button
            type="button"
            onClick={handleAddClip}
            className={cn(
              "flex items-center justify-center gap-1 px-2 py-1 rounded text-sm w-32 h-full",
              "bg-gray-600 hover:bg-gray-500 text-white",
              "transition-colors duration-200"
            )}
            title="Add this clip"
          >
            <Plus className="h-3 w-3" />
            Add Clip
          </button>
      </div>
    </div>
  );
} 