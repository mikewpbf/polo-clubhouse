import { useEffect, useState, useRef } from "react";
import { computeClockSeconds, formatClock, cn } from "@/lib/utils";

const EVENT_LABELS: Record<string, string> = {
  penalty: "Penalty",
  horse_change: "Horse Change",
  safety: "Safety",
  injury_timeout: "Injury Timeout",
};

interface MatchClockProps {
  clockStartedAt: string | null | undefined;
  clockElapsedSeconds: number;
  clockIsRunning: boolean;
  className?: string;
  size?: "sm" | "lg";
  status?: string;
  lastGoalScorerName?: string | null;
  lastGoalTimestamp?: string | null;
  lastStoppageEvent?: { eventType: string; playerName: string | null; timestamp: string } | null;
  delaySeconds?: number;
}

export function MatchClock({ 
  clockStartedAt, 
  clockElapsedSeconds, 
  clockIsRunning,
  className,
  size = "sm",
  status,
  lastGoalScorerName,
  lastGoalTimestamp,
  lastStoppageEvent,
  delaySeconds = 0,
}: MatchClockProps) {
  const [displaySeconds, setDisplaySeconds] = useState(() =>
    computeClockSeconds(clockStartedAt, clockElapsedSeconds, clockIsRunning, delaySeconds)
  );
  const [goalAlert, setGoalAlert] = useState<string | null>(null);
  const goalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGoalTsRef = useRef<string | null>(null);

  useEffect(() => {
    setDisplaySeconds(computeClockSeconds(clockStartedAt, clockElapsedSeconds, clockIsRunning, delaySeconds));

    if (!clockIsRunning) return;

    const interval = setInterval(() => {
      setDisplaySeconds(computeClockSeconds(clockStartedAt, clockElapsedSeconds, clockIsRunning, delaySeconds));
    }, 1000);

    return () => clearInterval(interval);
  }, [clockStartedAt, clockElapsedSeconds, clockIsRunning, delaySeconds]);

  useEffect(() => {
    if (lastGoalScorerName && lastGoalTimestamp && lastGoalTimestamp !== lastGoalTsRef.current) {
      lastGoalTsRef.current = lastGoalTimestamp;
      const age = Date.now() - new Date(lastGoalTimestamp).getTime();
      if (age < 8000) {
        setGoalAlert(lastGoalScorerName);
        if (goalTimerRef.current) clearTimeout(goalTimerRef.current);
        goalTimerRef.current = setTimeout(() => setGoalAlert(null), 5000);
      }
    }
  }, [lastGoalScorerName, lastGoalTimestamp]);

  const isHalftime = status === "halftime";

  const stoppageLabel = !clockIsRunning && lastStoppageEvent
    ? EVENT_LABELS[lastStoppageEvent.eventType] || lastStoppageEvent.eventType.replace(/_/g, " ")
    : null;

  const bannerText = goalAlert || stoppageLabel;
  const isSmall = size === "sm";

  return (
    <div className="flex flex-col items-center">
      {bannerText && (
        <div
          className={cn(
            "font-display font-semibold uppercase tracking-wider text-center transition-opacity duration-300",
            goalAlert ? "text-g700" : "text-amber-600",
            isSmall ? "text-[10px] mb-0.5" : "text-[12px] mb-1"
          )}
        >
          {goalAlert ? `Goal — ${goalAlert}` : bannerText}
        </div>
      )}
      <div 
        className={cn(
          "font-mono tracking-tight",
          clockIsRunning ? "text-live" : "text-g700",
          size === "lg" ? "text-[40px] leading-none font-bold" : "text-[28px] leading-none font-medium",
          className
        )}
      >
        {isHalftime ? <span className="font-display tracking-normal">Halftime</span> : formatClock(displaySeconds)}
      </div>
    </div>
  );
}
