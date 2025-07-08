"use client";

import { useState, useEffect } from "react";
import { Clock, Eye, Download, Loader2, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClipData } from "@/types";
import VideoPlayer from "@/components/VideoPlayer";
import ClipTimingDisplay from "@/components/ClipTimingDisplay";
import ClipsPreview from "@/components/ClipsPreview";
import ClipCard from "@/components/ClipCard";
import { ClipSceneAPI, JobStatus, VideoStatus, VideoInfo, VideoFormat, ClipsPreviewResponse } from "@/lib/api";
import { QualitySelector } from '@/components/QualitySelector';
import { QualityOption, getBestAvailableQuality, findFormatForQuality, isQualityAvailable } from '@/lib/quality-utils';

export default function Home() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [clips, setClips] = useState<ClipData[]>([]);
  const [showVideoPlayer, setShowVideoPlayer] = useState(true);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [videoStartTime, setVideoStartTime] = useState(0);
  const [videoEndTime, setVideoEndTime] = useState(30);
  const [videoDragging, setVideoDragging] = useState<'start' | 'end' | 'seek' | null>(null);
  
  // Backend integration state
  const [isProcessing, setIsProcessing] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // New separated workflow state
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadedVideo, setDownloadedVideo] = useState<VideoInfo | null>(null);
  const [videoStatus, setVideoStatus] = useState<VideoStatus | null>(null);
  

  
  // Auto-load video formats state
  const [availableFormats, setAvailableFormats] = useState<VideoFormat[]>([]);
  const [isLoadingFormats, setIsLoadingFormats] = useState(false);
  const [formatsError, setFormatsError] = useState<string | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<QualityOption>('1080p');

  // Clips preview state
  const [showClipsPreview, setShowClipsPreview] = useState(false);
  const [clipsPreviewData, setClipsPreviewData] = useState<ClipsPreviewResponse | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isCreatingClips, setIsCreatingClips] = useState(false);

  // Load available videos on component mount
  useEffect(() => {
    loadAvailableVideos();
  }, []);

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

  const handleDownloadVideo = async () => {
    if (!youtubeUrl.trim()) {
      alert("Please enter a YouTube URL");
      return;
    }

    setIsDownloading(true);
    setError(null);
    setVideoStatus(null);

    try {
      // Find the format for the selected quality using utility function
      const selectedFormat = findFormatForQuality(selectedQuality, availableFormats);

      const response = await ClipSceneAPI.downloadVideo({
        youtube_url: youtubeUrl.trim(),
        format_id: selectedFormat?.format_id
      });

      // Start polling for download status
      const finalStatus = await ClipSceneAPI.pollVideoStatus(response.video_id, (status) => {
        setVideoStatus(status);
      });

      // Set the downloaded video info
      if (finalStatus.status === 'completed') {
        setDownloadedVideo({
          video_id: response.video_id,
          title: finalStatus.title || 'Downloaded Video',
          file_size: finalStatus.file_size,
          youtube_url: youtubeUrl
        });
        // Refresh available videos list
        loadAvailableVideos();
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCreateClips = async () => {
    // This now works as a preview step - no actual clip creation yet
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

    setIsLoadingPreview(true);
    setError(null);

    try {
      // Use downloadedVideo if available, otherwise the API will use the latest video
      const response = await ClipSceneAPI.previewClips({
        video_id: downloadedVideo?.video_id,
        clips: clips.map(clip => ({
          title: clip.title,
          start_time: clip.startTime,
          end_time: clip.endTime
        }))
      });

      setClipsPreviewData(response);
      setShowClipsPreview(true);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview clips');
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleDownloadClips = async () => {
    if (!clipsPreviewData) {
      alert("No clips preview data available");
      return;
    }

    setIsCreatingClips(true);
    setError(null);
    setJobStatus(null);

    try {
      const response = await ClipSceneAPI.createClipsFromVideo({
        video_id: downloadedVideo?.video_id || '', // Use empty string if no downloadedVideo (API will use latest)
        clips: clips.map(clip => ({
          title: clip.title,
          start_time: clip.startTime,
          end_time: clip.endTime
        }))
      });

      setJobId(response.job_id);

      // Start polling for status
      await ClipSceneAPI.pollJobStatus(response.job_id, (status) => {
        setJobStatus(status);
      });

      // Hide preview on successful completion
      if (response.job_id) {
        setShowClipsPreview(false);
        setClipsPreviewData(null);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create clips');
    } finally {
      setIsCreatingClips(false);
    }
  };

  const handleCancelPreview = () => {
    setShowClipsPreview(false);
    setClipsPreviewData(null);
  };

  const loadAvailableVideos = async () => {
    // Function to reload videos list - not currently used in UI
    // but kept for future integration
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
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

    setIsProcessing(true);
    setError(null);
    setJobStatus(null);

    try {
      // Convert to API format
      const request = {
        youtube_url: youtubeUrl.trim(),
        clips: clips.map(clip => ({
          title: clip.title,
          start_time: clip.startTime,
          end_time: clip.endTime
        }))
      };

      // Submit to backend
      const response = await ClipSceneAPI.createClips(request);
      setJobId(response.job_id);

      // Start polling for status
      await ClipSceneAPI.pollJobStatus(response.job_id, (status) => {
        setJobStatus(status);
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen force-black-bg">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">

          {/* Main Form */}
          <div className="force-dark-bg rounded-xl shadow-lg p-6 mb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
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
                downloadStatus={isDownloading}
              />

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={handleDownloadVideo}
                  disabled={isDownloading || !youtubeUrl.trim()}
                  className={cn(
                    "flex-1 py-3 px-6 rounded-lg font-bold text-lg force-orange text-black",
                    "hover:bg-orange-600 hover:cursor-pointer",
                    "transition-all duration-200",
                    "focus:ring-2 focus:ring-orange-500 focus:ring-offset-2",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-600 disabled:text-gray-800",
                    "flex items-center justify-center gap-2"
                  )}
                >
                  {isDownloading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isDownloading ? "Downloading..." : `Download (${selectedQuality})`}
                </button>

                <button
                  type="button"
                  onClick={handleCreateClips}
                  disabled={isLoadingPreview || clips.length === 0}
                  className={cn(
                    "flex-1 py-3 px-6 rounded-lg font-bold text-lg",
                    "bg-gray-800 border-2 force-orange-border force-white-text",
                    "hover:force-orange hover:text-black hover:cursor-pointer",
                    "transition-all duration-200",
                    "focus:ring-2 focus:ring-orange-500 focus:ring-offset-2",
                    "disabled:opacity-50 disabled:cursor-not-allowed disabled:border-gray-600 disabled:text-gray-300",
                    "flex items-center justify-center gap-2"
                  )}
                >
                  {isLoadingPreview && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isLoadingPreview ? "Loading preview..." : "Create Clips"}
                </button>
              </div>
            </form>
          </div>

          {/* Clips Preview */}
          {showClipsPreview && clipsPreviewData && (
            <ClipsPreview
              previewData={clipsPreviewData}
              onDownloadClips={handleDownloadClips}
              onCancel={handleCancelPreview}
              isDownloading={isCreatingClips}
            />
          )}

          {/* Downloaded Video Status */}
          {videoStatus && (
            <div className="force-dark-bg rounded-xl shadow-lg p-6 mb-8">
              <h3 className="text-xl font-semibold text-theme-text-primary mb-4">
                Download Status
              </h3>
              
              <div className="space-y-4">
                {/* Progress */}
                <div>
                  <div className="flex justify-between text-sm text-theme-text-secondary mb-2">
                    <span>Progress</span>
                    <span>{videoStatus.status === 'completed' ? 'Complete' : 'Downloading...'}</span>
                  </div>
                  <div className="w-full bg-theme-bg-tertiary rounded-full h-2">
                    <div 
                      className={cn(
                        "h-2 rounded-full transition-all duration-300",
                        videoStatus.status === 'completed' ? "bg-theme-success" : 
                        videoStatus.status === 'error' ? "bg-theme-error" : "bg-theme-primary"
                      )}
                      style={{
                        width: videoStatus.status === 'completed' ? '100%' : '50%'
                      }}
                    />
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2">
                  <span className="text-theme-text-secondary">Status:</span>
                  <span className={cn(
                    "px-2 py-1 rounded text-sm font-medium",
                    videoStatus.status === 'downloading' && "bg-theme-primary/20 text-theme-primary",
                    videoStatus.status === 'completed' && "bg-theme-success/20 text-theme-success",
                    videoStatus.status === 'error' && "bg-theme-error/20 text-theme-error"
                  )}>
                    {videoStatus.status.charAt(0).toUpperCase() + videoStatus.status.slice(1)}
                  </span>
                </div>

                {/* Current Step */}
                {videoStatus.current_step && (
                  <div className="flex items-center gap-2">
                    <span className="text-theme-text-secondary">Current step:</span>
                    <span className="text-theme-text-primary font-medium">
                      {videoStatus.current_step}
                    </span>
                  </div>
                )}

                {/* Downloaded Video Info */}
                {videoStatus.status === 'completed' && videoStatus.title && (
                  <div className="p-3 bg-theme-bg-tertiary rounded-lg">
                    <div className="font-medium text-theme-text-primary">
                      {videoStatus.title}
                    </div>
                    <div className="text-sm text-theme-text-secondary">
                      Size: {(videoStatus.file_size / (1024 * 1024)).toFixed(2)} MB
                    </div>
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

          {/* Job Status Display */}
          {jobStatus && (
            <div className="bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white">
                  Processing Status
                </h3>

              </div>
              
              <div className="space-y-4">
                {/* Progress */}
                <div>
                  <div className="flex justify-between text-sm text-gray-300 mb-2">
                    <span>Progress</span>
                    <span>{jobStatus.completed_clips}/{jobStatus.total_clips} clips</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className={cn(
                        "h-2 rounded-full transition-all duration-300",
                        jobStatus.status === 'completed' ? "bg-green-500" : 
                        jobStatus.status === 'error' ? "bg-red-500" : 
                        jobStatus.status === 'downloading' ? "bg-yellow-500" : "bg-blue-500"
                      )}
                      style={{
                        width: jobStatus.status === 'downloading' ? '10%' : 
                               `${(jobStatus.completed_clips / jobStatus.total_clips) * 100}%`
                      }}
                    />
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2">
                  <span className="text-gray-300">Status:</span>
                  <span className={cn(
                    "px-2 py-1 rounded text-sm font-medium",
                    (jobStatus.status === 'processing' || jobStatus.status === 'downloading') && "bg-blue-600/20 text-blue-300",
                    jobStatus.status === 'completed' && "bg-green-600/20 text-green-300",
                    jobStatus.status === 'error' && "bg-red-600/20 text-red-300"
                  )}>
                    {jobStatus.status.charAt(0).toUpperCase() + jobStatus.status.slice(1)}
                  </span>
                </div>

                {/* Current Step */}
                {jobStatus.current_step && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-300">Current step:</span>
                    <span className="text-white font-medium">
                      {jobStatus.current_step}
                    </span>
                  </div>
                )}

                {/* Completed Clips */}
                {jobStatus.clips.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-300 mb-2">
                      Completed Clips:
                    </h4>
                    <div className="space-y-2">
                      {jobStatus.clips.map((clip, index) => (
                        <div
                          key={index}
                          className="p-3 bg-gray-700 rounded-lg"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-medium text-white">
                                {clip.title}
                              </span>
                              <div className="text-sm text-gray-400">
                                {clip.start_time} → {clip.end_time}
                              </div>
                            </div>
                            <div className="text-sm text-gray-400">
                              {(clip.file_size / (1024 * 1024)).toFixed(2)} MB
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
