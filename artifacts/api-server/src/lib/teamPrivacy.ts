import type { Team } from "@workspace/db/schema";

export type PublicTeam = Omit<Team, "jerseyImageUrl">;

// Strip private fields off a team row before serializing on a response that
// any non-owner / non-admin viewer might see. Jersey images are uploaded for
// the jumbotron / broadcast surface and should not leak on the public team
// directory endpoints. Mirrors `publicPlayer` for `broadcastImageUrl`.
export function publicTeam<T extends { jerseyImageUrl?: string | null }>(
  t: T,
): Omit<T, "jerseyImageUrl"> {
  const { jerseyImageUrl: _omit, ...rest } = t;
  return rest;
}
