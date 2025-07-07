import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClipData } from "@/types";

interface ClipCardProps {
  clip: ClipData;
  index: number;
  isSelected: boolean;
  onSelect: (clipId: string) => void;
  onUpdateClip: (id: string, field: keyof Omit<ClipData, 'id'>, value: string) => void;
  onRemoveClip: (id: string) => void;
}

export default function ClipCard({
  clip,
  index,
  isSelected,
  onSelect,
  onUpdateClip,
  onRemoveClip
}: ClipCardProps) {
  return (
    <div
      key={clip.id}
      className={cn(
        "p-4 border rounded-lg cursor-pointer transition-all duration-200",
        isSelected
          ? "border-gray-500 bg-gray-700"
          : "border-gray-600 bg-gray-800 hover:border-gray-500"
      )}
      onClick={() => onSelect(clip.id)}
    >
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0">
          <div className={cn(
            "text-sm font-medium",
            isSelected
              ? "text-gray-100"
              : "text-gray-400"
          )}>
            <div>
              Clip {index + 1}
              {isSelected && " (Editing)"}
            </div>
            {clip.title && (
              <div className="text-xs text-gray-500 mt-1">
                {clip.title}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              Start Time (hh:mm:ss)
            </label>
            <input
              type="text"
              value={clip.startTime}
              onChange={(e) => onUpdateClip(clip.id, 'startTime', e.target.value)}
              placeholder="00:01:30"
              pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
              className={cn(
                "w-full px-3 py-2 rounded border border-gray-600",
                "bg-gray-700 text-white",
                "focus:ring-2 focus:ring-gray-500 focus:border-transparent",
                "placeholder-gray-400"
              )}
              required
            />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              End Time (hh:mm:ss)
            </label>
            <input
              type="text"
              value={clip.endTime}
              onChange={(e) => onUpdateClip(clip.id, 'endTime', e.target.value)}
              placeholder="00:02:00"
              pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
              className={cn(
                "w-full px-3 py-2 rounded border border-gray-600",
                "bg-gray-700 text-white",
                "focus:ring-2 focus:ring-gray-500 focus:border-transparent",
                "placeholder-gray-400"
              )}
              required
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => onRemoveClip(clip.id)}
          className={cn(
            "flex-shrink-0 p-2 rounded-lg",
            "text-red-400 hover:bg-red-900/30",
            "transition-colors duration-200",
            "focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          )}
          title="Remove clip"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
} 