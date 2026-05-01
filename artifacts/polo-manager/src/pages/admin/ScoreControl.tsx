import { useRoute } from "wouter";
import { MatchControl } from "./MatchControl";

export function ScoreControl() {
  const [, params] = useRoute("/admin/score-control/:id");
  const matchId = params?.id;
  if (!matchId) return null;
  return <MatchControl mode="score" matchId={matchId} />;
}
