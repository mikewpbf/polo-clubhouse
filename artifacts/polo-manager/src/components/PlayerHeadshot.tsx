import { User } from "lucide-react";

interface PlayerHeadshotProps {
  url?: string | null;
  name: string;
  size?: number;
  className?: string;
}

export function PlayerHeadshot({ url, name, size = 48, className = "" }: PlayerHeadshotProps) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        style={{ width: size, height: size }}
        className={`rounded-full object-cover border border-line bg-g50 ${className}`}
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className={`rounded-full bg-g100 text-g500 flex items-center justify-center border border-g200 ${className}`}
      aria-label={`${name} (no headshot)`}
    >
      <User style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={1.5} />
    </div>
  );
}
