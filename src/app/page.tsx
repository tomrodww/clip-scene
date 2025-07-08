"use client";

import { useState, useEffect } from "react";
import { Clock, Eye, Loader2, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClipData } from "@/types";
import VideoPlayer from "@/components/VideoPlayer";
import ClipTimingDisplay from "@/components/ClipTimingDisplay";
import ClipCard from "@/components/ClipCard";
import { ClipSceneAPI, VideoFormat, JobStatusWithProgress } from "@/lib/api";
import { QualitySelector } from '@/components/QualitySelector';
import { QualityOption, getBestAvailableQuality, isQualityAvailable } from '@/lib/quality-utils';

export default function Home() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [clips, setClips] = useState<ClipData[]>([]);
  const [showVideoPlayer, setShowVideoPlayer] = useState(true);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [videoStartTime, setVideoStartTime] = useState(0);
  const [videoEndTime, setVideoEndTime] = useState(30);
  const [videoDragging, setVideoDragging] = useState<'start' | 'end' | 'seek' | null>(null);
  
  // Backend integration state
  const [error, setError] = useState<string | null>(null);
  
  // Auto-load video formats state
  const [availableFormats, setAvailableFormats] = useState<VideoFormat[]>([]);
  const [isLoadingFormats, setIsLoadingFormats] = useState(false);
  const [formatsError, setFormatsError] = useState<string | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<QualityOption>('1080p');

  // Unified process state
  const [isUnifiedProcessing, setIsUnifiedProcessing] = useState(false);
  const [unifiedJobId, setUnifiedJobId] = useState<string | null>(null);
  const [unifiedJobStatus, setUnifiedJobStatus] = useState<JobStatusWithProgress | null>(null);

  // Auto-fetch video formats when URL changes (with debouncing)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (youtubeUrl.trim() && isValidYouTubeUrl(youtubeUrl.trim())) {
        fetchVideoFormats(youtubeUrl.trim());
      } else {
        // Clear formats if URL is invalid or empty
        setAvailableFormats([]);
        setFormatsError(null);
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [youtubeUrl]);

  const isValidYouTubeUrl = (url: string): boolean => {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)/;
    return youtubeRegex.test(url);
  };

  const fetchVideoFormats = async (url: string) => {
    try {
      setIsLoadingFormats(true);
      setFormatsError(null);
      
      const response = await ClipSceneAPI.getVideoFormats({ youtube_url: url });
      setAvailableFormats(response.formats);
      
      if (response.formats.length === 0) {
        setFormatsError("No video formats found for this URL");
      } else {
        // Auto-select best available quality if current selection isn't available
        const isCurrentAvailable = isQualityAvailable(selectedQuality, response.formats);
        
        if (!isCurrentAvailable) {
          const bestQuality = getBestAvailableQuality(response.formats);
          if (bestQuality) {
            setSelectedQuality(bestQuality);
          }
        }
      }
    } catch (err) {
      setFormatsError(err instanceof Error ? err.message : 'Failed to load video formats');
      setAvailableFormats([]);
    } finally {
      setIsLoadingFormats(false);
    }
  };

  const removeClip = (id: string) => {
    if (clips.length > 0) {
      setClips(clips.filter(clip => clip.id !== id));
    }
  };

  const updateClip = (id: string, field: keyof Omit<ClipData, 'id'>, value: string) => {
    setClips(clips.map(clip => 
      clip.id === id ? { ...clip, [field]: value } : clip
    ));
  };

  const handleVideoTimeStateChange = (startTime: number, endTime: number, isDragging: 'start' | 'end' | 'seek' | null) => {
    setVideoStartTime(startTime);
    setVideoEndTime(endTime);
    setVideoDragging(isDragging);
  };

  const handleAddClipFromVideo = (startTime: string, endTime: string, title?: string) => {
    const newClip: ClipData = {
      id: Date.now().toString(),
      startTime,
      endTime,
      title
    };
    setClips([...clips, newClip]);
  };

  const validateTimeFormat = (time: string): boolean => {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
    return timeRegex.test(time);
  };

  const handleClipTimeUpdate = (startTime: string, endTime: string) => {
    if (selectedClipId) {
      updateClip(selectedClipId, 'startTime', startTime);
      updateClip(selectedClipId, 'endTime', endTime);
    }
  };

  const toggleVideoPlayer = () => {
    setShowVideoPlayer(!showVideoPlayer);
  };

  const selectClipForEditing = (clipId: string) => {
    setSelectedClipId(clipId);
  };

  const handleDownloadAndCreateClips = async () => {
    if (!youtubeUrl.trim()) {
      alert("Please enter a YouTube URL");
      return;
    }

    if (clips.length === 0) {
      alert("Please add at least one clip before creating clips");
      return;
    }

    const invalidClips = clips.filter(clip => 
      !validateTimeFormat(clip.startTime) || !validateTimeFormat(clip.endTime)
    );

    if (invalidClips.length > 0) {
      alert("Please enter valid time formats (hh:mm:ss) for all clips");
      return;
    }

    setIsUnifiedProcessing(true);
    setError(null);
    setUnifiedJobStatus(null);

    try {
      const response = await ClipSceneAPI.downloadAndCreateClips({
        youtube_url: youtubeUrl.trim(),
        clips: clips.map(clip => ({
          title: clip.title,
          start_time: clip.startTime,
          end_time: clip.endTime
        }))
      });

      setUnifiedJobId(response.job_id);

      // Start polling for unified status
      await ClipSceneAPI.pollUnifiedJobStatus(response.job_id, (status) => {
        setUnifiedJobStatus(status);
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Process failed');
    } finally {
      setIsUnifiedProcessing(false);
    }
  };

  return (
    <div className="min-h-screen force-black-bg">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">

          {/* Main Form */}
          <div className="force-dark-bg rounded-xl shadow-lg p-6 mb-8">
            <div className="space-y-6">
              {/* YouTube URL Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="youtube-url" className="block text-lg font-medium force-white-text">
                    Clipper Tool
                  </label>
                </div>
                
                <div className="flex items-center justify-between gap-2 h-10">
                  <input
                    id="youtube-url"
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className={cn(
                      "w-full px-4 h-full rounded-lg border border-theme-border-primary bg-theme-bg-tertiary text-theme-text-primary focus:ring-2 focus:ring-theme-primary focus:border-transparent placeholder-theme-text-muted"
                    )}
                    required
                  />
                  <button
                    type="button"
                    onClick={toggleVideoPlayer}
                    className={cn(
                      "flex items-center gap-2 px-3 h-full rounded-lg text-sm border border-gray-600 bg-gray-800 force-white-text hover:force-orange hover:text-black transition-colors duration-200 hover:cursor-pointer"
                    )}
                  >
                    <>
                      <Eye className="h-4 w-4" />
                      Preview
                    </>
                  </button>
                </div>

                {/* Format Loading Indicator */}
                {youtubeUrl.trim() && isValidYouTubeUrl(youtubeUrl.trim()) && (
                  <div className="flex items-center gap-2 text-sm">
                    {isLoadingFormats ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-theme-primary" />
                        <span className="text-theme-text-secondary">Loading video quality options...</span>
                      </>
                    ) : formatsError ? (
                      <>
                        <Video className="h-4 w-4 text-theme-error" />
                        <span className="text-theme-error">{formatsError}</span>
                      </>
                    ) : availableFormats.length > 0 ? (
                      <>
                        <Video className="h-4 w-4 text-theme-success" />
                        <span className="text-theme-success">
                          {availableFormats.length} quality options available
                        </span>
                        <span className="text-theme-text-muted">•</span>
                        <span className="text-theme-text-secondary">
                          Best: {availableFormats[0]?.quality_label}
                        </span>
                      </>
                    ) : null}
                  </div>
                )}
              </div>

                {/* Video Player */}
                {showVideoPlayer && (
                  <div className="space-y-4">
                    <VideoPlayer
                      youtubeUrl={youtubeUrl}
                      onClipTimeUpdate={handleClipTimeUpdate}
                      selectedClipId={selectedClipId || undefined}
                      initialStartTime={selectedClipId ? clips.find(c => c.id === selectedClipId)?.startTime || undefined : undefined}
                      initialEndTime={selectedClipId ? clips.find(c => c.id === selectedClipId)?.endTime || undefined : undefined}
                      onTimeStateChange={handleVideoTimeStateChange}
                    />
                    
                    <ClipTimingDisplay
                      startTime={videoStartTime}
                      endTime={videoEndTime}
                      isDragging={videoDragging}
                      onAddClip={handleAddClipFromVideo}
                    />
                  </div>
                )}

              {/* Clips Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-theme-text-primary flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Clip Timings
                  </h3>

                </div>

                {/* Clip Blocks */}
                <div className="space-y-3">
                  {clips.length === 0 ? (
                    <div className="text-center py-8 text-theme-text-muted">
                      No clips added yet.
                    </div>
                  ) : (
                    clips.map((clip, index) => (
                      <ClipCard
                        key={clip.id}
                        clip={clip}
                        index={index}
                        isSelected={selectedClipId === clip.id}
                        onSelect={selectClipForEditing}
                        onUpdateClip={updateClip}
                        onRemoveClip={removeClip}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Quality Selection */}
              <QualitySelector
                selectedQuality={selectedQuality}
                onQualityChange={setSelectedQuality}
                availableFormats={availableFormats}
                isLoadingFormats={isLoadingFormats}
                youtubeUrl={youtubeUrl}
                isValidYouTubeUrl={isValidYouTubeUrl}
                downloadStatus={isUnifiedProcessing}
              />

              {/* Unified Action Button */}
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleDownloadAndCreateClips}
                  disabled={isUnifiedProcessing || !youtubeUrl.trim() || clips.length === 0}
                  className={cn(
                    "w-full py-4 px-8 rounded-lg font-bold text-xl force-orange text-black",
                    "hover:bg-orange-600 hover:cursor-pointer",
                    "transition-all duration-200",
                    "focus:ring-2 focus:ring-orange-500 focus:ring-offset-2",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-600 disabled:text-gray-800",
                    "flex items-center justify-center gap-3"
                  )}
                >
                  {isUnifiedProcessing && <Loader2 className="h-5 w-5 animate-spin" />}
                  {isUnifiedProcessing ? "Processing..." : `Download and Create Clips (${selectedQuality})`}
                </button>
              </div>
            </div>
          </div>

                    {/* Unified Process Status */}
          {unifiedJobStatus && (
            <div className="force-dark-bg rounded-xl shadow-lg p-6 mb-8">
              <h3 className="text-xl font-semibold text-theme-text-primary mb-4">
                Download and Create Clips Progress
              </h3>
              
              <div className="space-y-4">
                {/* Progress Bar */}
                <div>
                  <div className="flex justify-between text-sm text-theme-text-secondary mb-2">
                    <span>Overall Progress</span>
                    <span>{unifiedJobStatus.progress_percentage}%</span>
                  </div>
                  <div className="w-full bg-theme-bg-tertiary rounded-full h-3">
                    <div 
                      className={cn(
                        "h-3 rounded-full transition-all duration-500",
                        unifiedJobStatus.status === 'completed' ? "bg-green-500" : 
                        unifiedJobStatus.status === 'error' ? "bg-red-500" : "bg-orange-500"
                      )}
                      style={{
                        width: `${unifiedJobStatus.progress_percentage}%`
                      }}
                    />
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  <span className="text-theme-text-secondary">Status:</span>
                  <span className={cn(
                    "px-3 py-1 rounded-full text-sm font-medium",
                    unifiedJobStatus.status === 'downloading' && "bg-blue-500/20 text-blue-300",
                    unifiedJobStatus.status === 'processing' && "bg-orange-500/20 text-orange-300",
                    unifiedJobStatus.status === 'completed' && "bg-green-500/20 text-green-300",
                    unifiedJobStatus.status === 'error' && "bg-red-500/20 text-red-300"
                  )}>
                    {unifiedJobStatus.status.charAt(0).toUpperCase() + unifiedJobStatus.status.slice(1)}
                  </span>
                </div>

                {/* Current Step */}
                <div className="flex items-center gap-2">
                  <span className="text-theme-text-secondary">Current step:</span>
                  <span className="text-theme-text-primary font-medium">
                    {unifiedJobStatus.current_step}
                  </span>
                </div>

                {/* Clips Progress */}
                {unifiedJobStatus.total_clips > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-theme-text-secondary">Clips completed:</span>
                    <span className="text-theme-text-primary font-medium">
                      {unifiedJobStatus.completed_clips} / {unifiedJobStatus.total_clips}
                    </span>
                  </div>
                )}

                {/* Error Details */}
                {unifiedJobStatus.error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <div className="text-red-400 font-medium">Error:</div>
                    <div className="text-red-300 text-sm mt-1">{unifiedJobStatus.error}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-theme-error/10 border border-theme-error rounded-xl shadow-lg p-6 mb-8">
              <h3 className="text-xl font-semibold text-theme-error mb-2">
                Error
              </h3>
              <p className="text-theme-error">{error}</p>
            </div>
          )}


        </div>
      </div>
    </div>
  );
}
