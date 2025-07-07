"use client";

import { useState } from "react";
import { Clock, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClipData, FormData } from "@/types";
import VideoPlayer from "@/components/VideoPlayer";
import ClipTimingDisplay from "@/components/ClipTimingDisplay";
import ClipCard from "@/components/ClipCard";

export default function Home() {
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [clips, setClips] = useState<ClipData[]>([]);
  const [submittedData, setSubmittedData] = useState<FormData | null>(null);
  const [showVideoPlayer, setShowVideoPlayer] = useState(true);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [videoStartTime, setVideoStartTime] = useState(0);
  const [videoEndTime, setVideoEndTime] = useState(30);
  const [videoDragging, setVideoDragging] = useState<'start' | 'end' | 'seek' | null>(null);



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

  const handleSubmit = (e: React.FormEvent) => {
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

    const formData: FormData = {
      youtubeUrl: youtubeUrl.trim(),
      clips: clips
    };

    // Log the data for now (as requested)
    console.log("Form Data:", formData);
    setSubmittedData(formData);
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

              {/* Submit Button */}
              <button
                type="submit"
                className={cn(
                  "w-full py-3 px-6 rounded-lg font-medium",
                  "bg-gradient-to-r from-gray-700 to-gray-800",
                  "hover:from-gray-600 hover:to-gray-700",
                  "text-white transition-all duration-200",
                  "focus:ring-2 focus:ring-gray-500 focus:ring-offset-2",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                Create Clips
              </button>
            </form>
          </div>

          {/* Display Results */}
          {submittedData && (
            <div className="bg-gray-800 rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-4">
                Submitted Data
              </h3>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-300 mb-2">
                    YouTube URL:
                  </h4>
                  <p className="text-gray-300 break-all">
                    {submittedData.youtubeUrl}
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-gray-300 mb-2">
                    Clips ({submittedData.clips.length}):
                  </h4>
                  <div className="space-y-2">
                    {submittedData.clips.map((clip, index) => (
                      <div
                        key={clip.id}
                        className="p-3 bg-gray-700 rounded-lg"
                      >
                        <div>
                          <span className="font-medium text-white">
                            Clip {index + 1}:
                          </span>
                          <span className="ml-2 text-gray-400">
                            {clip.startTime} → {clip.endTime}
                          </span>
                        </div>
                        {clip.title && (
                          <div className="text-sm text-gray-300 mt-1">
                            {clip.title}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
