import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | null | undefined, formatStr: string = "MMM d, yyyy") {
  if (!dateString) return "";
  try {
    const d = parseISO(dateString);
    return format(d, formatStr);
  } catch (e) {
    return dateString;
  }
}

export function formatTime(timeString: string | null | undefined) {
  if (!timeString) return "";
  // Handles HH:mm:ss or HH:mm formats
  try {
    const [hours, minutes] = timeString.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  } catch (e) {
    return timeString;
  }
}

const CHUKKER_DURATION = 450; // 7 minutes 30 seconds

export function computeClockSeconds(
  clockStartedAt: string | null | undefined,
  clockElapsedSeconds: number,
  clockIsRunning: boolean,
  delaySeconds: number = 0
): number {
  let elapsed = clockElapsedSeconds;
  if (clockIsRunning && clockStartedAt) {
    const startTime = new Date(clockStartedAt).getTime();
    const now = Date.now();
    elapsed += Math.floor((now - startTime) / 1000);
  }
  elapsed = Math.max(0, elapsed - delaySeconds);
  return Math.max(0, Math.floor(CHUKKER_DURATION - elapsed));
}

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
