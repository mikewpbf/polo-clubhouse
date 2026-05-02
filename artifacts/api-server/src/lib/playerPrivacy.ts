import type { Player } from "@workspace/db/schema";

export type PublicPlayer = Omit<Player, "broadcastImageUrl">;

// Strip private fields off a player row before serializing on a response that
// any non-owner / non-admin viewer might see. Keeping the whitelist negative
// (Omit<Player, "broadcastImageUrl">) means new public columns added to the
// players table flow through automatically; new private columns must be added
// here AND to the type.
export function publicPlayer<T extends { broadcastImageUrl?: string | null }>(
  p: T,
): Omit<T, "broadcastImageUrl"> {
  const { broadcastImageUrl: _omit, ...rest } = p;
  return rest;
}
