export function getYouTubeEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (trimmed.includes("youtube.com/embed/")) {
    const base = trimmed.split("?")[0];
    return `${base}?autoplay=1&mute=1&rel=0&modestbranding=1`;
  }

  let videoId: string | null = null;

  const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) {
    videoId = watchMatch[1];
  }

  if (!videoId) {
    const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortMatch) {
      videoId = shortMatch[1];
    }
  }

  if (!videoId) {
    const liveMatch = trimmed.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/);
    if (liveMatch) {
      videoId = liveMatch[1];
    }
  }

  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&rel=0&modestbranding=1`;
  }

  return null;
}
