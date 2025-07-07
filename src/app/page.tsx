"use client";

import { useState, useEffect } from "react";
import { Clock, Eye, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClipData } from "@/types";
import VideoPlayer from "@/components/VideoPlayer";
import ClipTimingDisplay from "@/components/ClipTimingDisplay";
import ClipCard from "@/components/ClipCard";
import { ClipSceneAPI, JobStatus, VideoStatus, VideoInfo } from "@/lib/api";

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

  // Load available videos on component mount
  useEffect(() => {
    loadAvailableVideos();
  }, []);

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
      const response = await ClipSceneAPI.downloadVideo({
        youtube_url: youtubeUrl.trim()
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
    if (!downloadedVideo) {
      alert("Please download a video first");
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
      const response = await ClipSceneAPI.createClipsFromVideo({
        video_id: downloadedVideo.video_id,
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

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create clips');
    } finally {
      setIsProcessing(false);
    }
  };

  const loadAvailableVideos = async () => {
    try {
      const response = await ClipSceneAPI.listVideos();
      // Just load them in background for now, we can use them later if needed
      console.log('Available videos:', response.videos);
    } catch (err) {
      console.error('Failed to load videos:', err);
    }
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">

          {/* Main Form */}
          <div className="bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* YouTube URL Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="youtube-url" className="block text-lg font-medium text-gray-300">
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
                      "w-full px-4 h-full rounded-lg border border-gray-600",
                      "bg-gray-700 text-white",
                      "focus:ring-2 focus:ring-gray-500 focus:border-transparent",
                      "placeholder-gray-400"
                    )}
                    required
                  />
                  <button
                    type="button"
                    onClick={toggleVideoPlayer}
                    className={cn(
                      "flex items-center gap-2 px-3 h-full rounded-lg text-sm",
                      "border border-gray-600",
                      "hover:bg-gray-700",
                      "transition-colors duration-200"
                    )}
                  >
                    <>
                      <Eye className="h-4 w-4" />
                      Preview
                    </>
                  </button>
                </div>
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
                  <h3 className="text-lg font-medium text-white flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Clip Timings
                  </h3>

                </div>

                {/* Clip Blocks */}
                <div className="space-y-3">
                  {clips.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
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

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={handleDownloadVideo}
                  disabled={isDownloading || !youtubeUrl.trim()}
                  className={cn(
                    "flex-1 py-3 px-6 rounded-lg font-medium",
                    "bg-gradient-to-r from-blue-600 to-blue-700",
                    "hover:from-blue-500 hover:to-blue-600",
                    "text-white transition-all duration-200",
                    "focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "flex items-center justify-center gap-2"
                  )}
                >
                  {isDownloading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isDownloading ? "Downloading..." : "Download"}
                </button>

                <button
                  type="button"
                  onClick={handleCreateClips}
                  disabled={isProcessing || !downloadedVideo || clips.length === 0}
                  className={cn(
                    "flex-1 py-3 px-6 rounded-lg font-medium",
                    "bg-gradient-to-r from-green-600 to-green-700",
                    "hover:from-green-500 hover:to-green-600",
                    "text-white transition-all duration-200",
                    "focus:ring-2 focus:ring-green-500 focus:ring-offset-2",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "flex items-center justify-center gap-2"
                  )}
                >
                  {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isProcessing ? "Creating clips..." : "Create Clips"}
                </button>
              </div>
            </form>
          </div>

                    {/* Downloaded Video Status */}
          {videoStatus && (
            <div className="bg-gray-800 rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-4">
                Download Status
              </h3>
              
              <div className="space-y-4">
                {/* Progress */}
                <div>
                  <div className="flex justify-between text-sm text-gray-300 mb-2">
                    <span>Progress</span>
                    <span>{videoStatus.status === 'completed' ? 'Complete' : 'Downloading...'}</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div 
                      className={cn(
                        "h-2 rounded-full transition-all duration-300",
                        videoStatus.status === 'completed' ? "bg-green-500" : 
                        videoStatus.status === 'error' ? "bg-red-500" : "bg-yellow-500"
                      )}
                      style={{
                        width: videoStatus.status === 'completed' ? '100%' : '50%'
                      }}
                    />
                  </div>
                </div>

                {/* Status */}
                <div className="flex items-center gap-2">
                  <span className="text-gray-300">Status:</span>
                  <span className={cn(
                    "px-2 py-1 rounded text-sm font-medium",
                    videoStatus.status === 'downloading' && "bg-yellow-600/20 text-yellow-300",
                    videoStatus.status === 'completed' && "bg-green-600/20 text-green-300",
                    videoStatus.status === 'error' && "bg-red-600/20 text-red-300"
                  )}>
                    {videoStatus.status.charAt(0).toUpperCase() + videoStatus.status.slice(1)}
                  </span>
                </div>

                {/* Current Step */}
                {videoStatus.current_step && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-300">Current step:</span>
                    <span className="text-white font-medium">
                      {videoStatus.current_step}
                    </span>
                  </div>
                )}

                {/* Downloaded Video Info */}
                {videoStatus.status === 'completed' && videoStatus.title && (
                  <div className="p-3 bg-gray-700 rounded-lg">
                    <div className="font-medium text-white">
                      {videoStatus.title}
                    </div>
                    <div className="text-sm text-gray-400">
                      Size: {(videoStatus.file_size / (1024 * 1024)).toFixed(2)} MB
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-900/50 border border-red-700 rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-red-300 mb-2">
                Error
              </h3>
              <p className="text-red-200">{error}</p>
            </div>
          )}

          {/* Job Status Display */}
          {jobStatus && (
            <div className="bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-white">
                  Processing Status
                </h3>
                {jobStatus.status === 'completed' && jobId && (
                  <a
                    href={ClipSceneAPI.getDownloadUrl(jobId)}
                    download
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg",
                      "bg-green-600 hover:bg-green-700",
                      "text-white transition-colors duration-200"
                    )}
                  >
                    <Download className="h-4 w-4" />
                    Download Clips
                  </a>
                )}
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
