import { Trash2 } from "lucide-react";
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
  onSelect,
  onUpdateClip,
  onRemoveClip
}: ClipCardProps) {
  return (
    <div
      key={clip.id}
      className="py-2 px-4 border rounded-lg"
      onClick={() => onSelect(clip.id)}
    >
      <div className="relative flex flex-col items-start gap-2">
        <div className="flex-shrink-0 text-sm font-medium flex flex-row items-center h-8">
          <span>Clip {index + 1}: <span className="text-xs text-gray-400">{clip.title}</span></span> 
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
              className="w-24 text-center p-2 rounded border border-theme-border-primary text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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
              pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
              className="w-24 text-center p-2 rounded border border-theme-border-primary text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              required
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => onRemoveClip(clip.id)}
          className="absolute right-0 top-4 flex-shrink-0 p-2 rounded-lg text-theme-error hover:bg-theme-error/20 transition-colors duration-200 focus:ring-2 focus:ring-theme-error focus:ring-offset-2 hover:cursor-pointer"
          title="Remove clip"
        >
          <Trash2 className="h-4 w-4 text-red-500" />
        </button>
      </div>
    </div>
  );
} 