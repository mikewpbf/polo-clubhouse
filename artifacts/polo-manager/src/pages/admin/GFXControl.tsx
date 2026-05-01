import { useRoute } from "wouter";
import { MatchControl } from "./MatchControl";

export function GFXControl() {
  const [, params] = useRoute("/admin/gfx-control/:id");
  const matchId = params?.id;
  if (!matchId) return null;
  return <MatchControl mode="gfx" matchId={matchId} />;
}
