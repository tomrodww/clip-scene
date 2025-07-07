"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';
import { Play, Pause, RotateCcw, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { extractYouTubeVideoId, formatSecondsToTime } from '@/lib/youtube';

interface VideoPlayerProps {
  youtubeUrl: string;
  onClipTimeUpdate: (startTime: string, endTime: string) => void;
  selectedClipId?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  onTimeStateChange?: (startTime: number, endTime: number, isDragging: 'start' | 'end' | 'seek' | null) => void;
}

export default function VideoPlayer({ 
  youtubeUrl, 
  onClipTimeUpdate, 
  selectedClipId,
  initialStartTime = "00:00:00",
  initialEndTime = "00:00:30",
  onTimeStateChange
}: VideoPlayerProps) {
  const [player, setPlayer] = useState<any>(null); // YouTube player instance
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'seek' | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(30);
  
  const progressBarRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const videoId = extractYouTubeVideoId(youtubeUrl);

  // Initialize start and end times from props ONLY ONCE when clip changes
  useEffect(() => {
    if (initialStartTime && initialEndTime) {
      const startSeconds = parseTimeToSeconds(initialStartTime);
      const endSeconds = parseTimeToSeconds(initialEndTime);
      setStartTime(startSeconds);
      setEndTime(endSeconds);
    }
  }, [selectedClipId]); // Only when clip changes, NOT when times change

  // Notify parent of time state changes
  useEffect(() => {
    onTimeStateChange?.(startTime, endTime, isDragging);
  }, [startTime, endTime, isDragging, onTimeStateChange]);

  const parseTimeToSeconds = (timeString: string): number => {
    const parts = timeString.split(':').map(Number);
    if (parts.length === 3) {
      const [hours, minutes, seconds] = parts;
      return hours * 3600 + minutes * 60 + seconds;
    }
    return 0;
  };

  const onReady: YouTubeProps['onReady'] = (event) => {
    setPlayer(event.target);
    setDuration(event.target.getDuration());
  };

  const onPlay = () => {
    setIsPlaying(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (player) {
        const time = player.getCurrentTime();
        setCurrentTime(time);
        
        // Auto-pause at end time
        if (time >= endTime) {
          player.pauseVideo();
          setIsPlaying(false);
        }
      }
    }, 100);
  };

  const onPause = () => {
    setIsPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const togglePlayPause = () => {
    if (!player) return;
    
    if (isPlaying) {
      player.pauseVideo();
    } else {
      // Start from start time if we're before it or after end time
      const currentTime = player.getCurrentTime();
      if (currentTime < startTime || currentTime >= endTime) {
        player.seekTo(startTime, true);
      }
      player.playVideo();
    }
  };

  const seekToStart = () => {
    if (player) {
      player.seekTo(startTime, true);
      setCurrentTime(startTime);
    }
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !player || isDragging) return;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const seekTime = percentage * duration;
    
    player.seekTo(seekTime, true);
    setCurrentTime(seekTime);
  };



  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !progressBarRef.current || !player) return;
    
    e.preventDefault();
    const rect = progressBarRef.current.getBoundingClientRect();
    const dragX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, dragX / rect.width));
    const newTime = percentage * duration;
    
    if (isDragging === 'start') {
      const newStartTime = Math.min(newTime, endTime - 1);
      setStartTime(newStartTime);
      onClipTimeUpdate(formatSecondsToTime(newStartTime), formatSecondsToTime(endTime));
      
      // Seek video to start handle position so user can see what's there
      player.seekTo(newStartTime, true);
      setCurrentTime(newStartTime);
    } else if (isDragging === 'end') {
      const newEndTime = Math.max(newTime, startTime + 1);
      setEndTime(newEndTime);
      onClipTimeUpdate(formatSecondsToTime(startTime), formatSecondsToTime(newEndTime));
    }
  }, [isDragging, duration, startTime, endTime, onClipTimeUpdate, player]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(null);
    // Don't automatically seek when dragging ends - let user control playback position
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      return () => {
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const opts: YouTubeProps['opts'] = {
    height: '360',
    width: '100%',
    playerVars: {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      fs: 0,
      iv_load_policy: 3,
      modestbranding: 1,
      rel: 0,
    },
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  const startPercentage = duration > 0 ? (startTime / duration) * 100 : 0;
  const endPercentage = duration > 0 ? (endTime / duration) * 100 : 0;
  const clipWidth = endPercentage - startPercentage;

  return (
    <div className="bg-gray-800">
      <div className="relative rounded-lg overflow-hidden mb-2">
        {videoId ? (
          <YouTube
            videoId={videoId}
            opts={opts}
            onReady={onReady}
            onPlay={onPlay}
            onPause={onPause}
            className="w-full"
          />
        ) : (
          <div 
            className="w-full bg-black flex items-center justify-center text-gray-500"
            style={{ height: '360px' }}
          >
            <p>No video loaded</p>
          </div>
        )}
      </div>
                
      <div className="relative group">
        {/* Main progress bar track */}
        <div
          ref={progressBarRef}
          className={cn(
            "relative h-2 bg-gray-600 cursor-pointer",
            "transition-all duration-200"
          )}
          onClick={handleProgressBarClick}
        >
          {/* Background track */}
          <div className="absolute inset-0 bg-gray-600" />
          
          {/* Watched progress (before start) */}
          {progressPercentage < startPercentage && (
            <div
              className="absolute top-0 h-full bg-gray-500 transition-all duration-100"
              style={{ 
                width: `${progressPercentage}%`
              }}
            />
          )}
          
          {/* Clip selection area (between start and end) */}
          <div
            className={cn(
              "absolute top-0 h-full bg-gray-700",
              "transition-all duration-100"
            )}
            style={{
              left: `${startPercentage}%`,
              width: `${clipWidth}%`,
            }}
          />
          
          {/* Current playback progress within clip area */}
          {progressPercentage >= startPercentage && progressPercentage <= endPercentage && (
            <div
              className="absolute top-0 h-full bg-white transition-all duration-100"
              style={{ 
                left: `${startPercentage}%`,
                width: `${Math.min(progressPercentage - startPercentage, clipWidth)}%`
              }}
            />
          )}
        </div>

        {/* Start time handle with vertical line */}
        <div
          className="absolute transform -translate-x-1/2 z-30 top-0 h-full"
          style={{ left: `${startPercentage}%`}}
        >
          {/* Vertical line */}
          <div className="absolute left-1/2 transform -translate-x-1/2 w-0.5 bg-white h-3" />
          
          {/* Circle handle on top */}
          <div
            className={cn(
              "absolute -bottom-2.5 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-white rounded-full cursor-pointer",
              isDragging === 'start' && "scale-125 bg-white"
            )}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging('start');
              // Don't automatically seek - let user control when to seek
            }}
            title={`Start: ${formatSecondsToTime(startTime)}`}
          />
        </div>

        {/* End time handle with vertical line */}
        <div
          className="absolute transform -translate-x-1/2 z-30 top-0 h-full"
          style={{ left: `${endPercentage}%`}}
        >
          {/* Vertical line */}
          <div className="absolute left-1/2 transform -translate-x-1/2 w-0.5 bg-white h-3" />
          
          {/* Circle handle on top */}
          <div
            className={cn(
              "absolute -bottom-2.5 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-white rounded-full cursor-pointer",
              isDragging === 'end' && "scale-125 bg-white"
            )}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging('end');
            }}
            title={`End: ${formatSecondsToTime(endTime)}`}
          />
        </div>


        {/* Hover time tooltip */}
        <div
          className={cn(
            "absolute bottom-8 transform -translate-x-1/2",
            "bg-black text-white text-xs px-2 py-1 rounded",
            "opacity-0 group-hover:opacity-100 transition-opacity",
            "pointer-events-none z-40"
          )}
          style={{ 
            left: `${progressPercentage}%`,
            display: isDragging ? 'block' : 'none'
          }}
        >
          {formatSecondsToTime(currentTime)}
        </div>
      </div>

      {/* Custom Controls */}
      <div className="py-4 space-y-4">
        {/* Transport Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlayPause}
              className={cn(
                "py-2 px-4 rounded-lg transition-colors",
                "bg-gray-600 hover:bg-gray-500 text-white"
              )}
              disabled={!player}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            
            <button
              onClick={seekToStart}
              className={cn(
                "p-2 rounded-lg transition-colors",
                "bg-gray-600 hover:bg-gray-500 text-white"
              )}
              disabled={!player}
              title="Go to clip start"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            {/* Time Display */}
            <div className="flex justify-between text-sm text-gray-400">
              <span>{formatSecondsToTime(currentTime)} / {formatSecondsToTime(duration)}</span>
            </div>
          </div>
          
          
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4 text-gray-400" />
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => {
                const newVolume = parseInt(e.target.value);
                setVolume(newVolume);
                if (player) player.setVolume(newVolume);
              }}
              className="w-20"
            />
          </div>
        </div>




      </div>
    </div>
  );
} 