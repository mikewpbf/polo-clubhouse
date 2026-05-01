import { useRoute } from "wouter";
import { MatchControl } from "./MatchControl";

export function StatsControl() {
  const [, params] = useRoute("/admin/stats-control/:id");
  const matchId = params?.id;
  if (!matchId) return null;
  return <MatchControl mode="stats" matchId={matchId} />;
}
