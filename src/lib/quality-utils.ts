interface VideoFormat {
  format_id: string;
  quality_label: string;
  resolution: string;
  fps: string | number;
  ext: string;
  filesize_mb?: number;
  note?: string;
}

export type QualityOption = '720p' | '1080p' | '1440p' | '4K';

/**
 * Check if a quality is available in the given formats
 */
export const isQualityAvailable = (
  quality: QualityOption,
  formats: VideoFormat[]
): boolean => {
  const targetResolution = getTargetResolution(quality);
  
  return formats.some(format => {
    const resolution = format.resolution?.toLowerCase() || '';
    return resolution.includes(targetResolution) || 
           (quality === '4K' && (resolution.includes('2160') || resolution.includes('4k'))) ||
           (quality === '1440p' && resolution.includes('1440')) ||
           (quality === '1080p' && resolution.includes('1080')) ||
           (quality === '720p' && resolution.includes('720'));
  });
};

/**
 * Find the best format for a given quality
 */
export const findFormatForQuality = (
  quality: QualityOption,
  formats: VideoFormat[]
): VideoFormat | undefined => {
  const targetResolution = getTargetResolution(quality);
  
  return formats.find(format => {
    const resolution = format.resolution?.toLowerCase() || '';
    return resolution.includes(targetResolution) || 
           (quality === '4K' && (resolution.includes('2160') || resolution.includes('4k'))) ||
           (quality === '1440p' && resolution.includes('1440')) ||
           (quality === '1080p' && resolution.includes('1080')) ||
           (quality === '720p' && resolution.includes('720'));
  });
};

/**
 * Get the best available quality from formats, with preference order
 */
export const getBestAvailableQuality = (
  formats: VideoFormat[],
  preferenceOrder: QualityOption[] = ['1080p', '1440p', '720p', '4K']
): QualityOption | null => {
  for (const quality of preferenceOrder) {
    if (isQualityAvailable(quality, formats)) {
      return quality;
    }
  }
  return null;
};

/**
 * Convert quality label to target resolution number
 */
const getTargetResolution = (quality: QualityOption): string => {
  switch (quality) {
    case '4K': return '2160';
    case '1440p': return '1440';
    case '1080p': return '1080';
    case '720p': return '720';
    default: return '1080';
  }
}; 