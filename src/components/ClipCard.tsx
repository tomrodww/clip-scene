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
        "py-2 px-4 border rounded-lg cursor-pointer transition-all duration-200 force-dark-bg",
        isSelected
          ? "border-theme-primary bg-theme-primary/10"
          : "border-theme-border-primary hover:border-theme-primary"
      )}
      onClick={() => onSelect(clip.id)}
    >
      <div className="flex flex-col items-start gap-2">
        <div className="flex-shrink-0">
          <div className={cn(
            "text-sm font-medium flex flex-row items-center h-8",
            isSelected
              ? "force-orange-text"
              : "force-white-text"
          )}>
            <div className="text-center">
              Clip {index + 1}: <span className="text-xs text-gray-400">{clip.title}</span>
              {isSelected && " (Editing)"}
            </div>
          </div>
        </div>
        
        <div className="flex flex-row gap-4 h-8">
          <div className="flex flex-row items-center">
            <label className="block text-sm font-medium text-gray-400 pr-2">
              Start
            </label>
            <input
              type="text"
              value={clip.startTime}
              onChange={(e) => onUpdateClip(clip.id, 'startTime', e.target.value)}
              pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
              className={cn(
                "w-fit p-2 rounded border border-theme-border-primary",
                "force-white-text",
                "focus:ring-2 focus:ring-orange-500 focus:border-orange-500",
                "placeholder-gray-400"
              )}
              required
            />
          </div>
          
          <div className="flex flex-row items-center">
            <label className="block text-sm font-medium text-gray-400 pr-2">
              End
            </label>
            <input
              type="text"
              value={clip.endTime}
              onChange={(e) => onUpdateClip(clip.id, 'endTime', e.target.value)}
              placeholder="00:02:00"
              pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
              className={cn(
                "w-fit p-2 rounded border border-theme-border-primary",
                "force-white-text",
                "focus:ring-2 focus:ring-orange-500 focus:border-orange-500",
                "placeholder-gray-400"
              )}
              required
            />
          </div>
        <button
          type="button"
          onClick={() => onRemoveClip(clip.id)}
          className={cn(
            "flex-shrink-0 p-2 rounded-lg",
            "text-theme-error hover:bg-theme-error/20",
            "transition-colors duration-200",
            "focus:ring-2 focus:ring-theme-error focus:ring-offset-2 hover:cursor-pointer"
          )}
          title="Remove clip"
        >
          <Trash2 className="h-4 w-4 text-red-500" />
        </button>
        </div>

      </div>
    </div>
  );
} 