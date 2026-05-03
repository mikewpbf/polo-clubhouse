import type { Response } from "express";

type SSEClient = {
  res: Response;
  matchId: string;
};

const clients = new Map<string, Set<SSEClient>>();

// Task #121 (step 4): typed event names. Documented as `x-events` in the
// OpenAPI spec so mobile/TV teams can implement against the contract instead
// of reading server code. Existing clients only watch for the legacy
// `update` / `match_ended` shapes — the typed events fire alongside them so
// no current consumer breaks.
export type MatchEventName =
  | "update"
  | "match_ended"
  | "score.updated"
  | "clock.tick"
  | "gfx.trigger"
  | "match.ended"
  | "chukker.changed";

export function addSSEClient(matchId: string, res: Response): SSEClient {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(":\n\n");

  const client: SSEClient = { res, matchId };
  if (!clients.has(matchId)) {
    clients.set(matchId, new Set());
  }
  clients.get(matchId)!.add(client);

  res.on("close", () => {
    removeSSEClient(client);
  });

  return client;
}

export function removeSSEClient(client: SSEClient) {
  const set = clients.get(client.matchId);
  if (set) {
    set.delete(client);
    if (set.size === 0) {
      clients.delete(client.matchId);
    }
  }
}

// `named=false` writes a default-event frame (no `event:` line) so existing
// browser consumers that listen via `EventSource.onmessage` keep receiving
// legacy `update` / `match_ended` payloads. `named=true` adds the typed
// `event:` line for new clients (mobile/TV) that use `addEventListener`.
function writeFrame(matchId: string, event: MatchEventName, data: Record<string, unknown>, named: boolean): void {
  const set = clients.get(matchId);
  if (!set || set.size === 0) return;
  const payload = JSON.stringify({ type: event, ...data });
  const frame = named ? `event: ${event}\ndata: ${payload}\n\n` : `data: ${payload}\n\n`;
  for (const client of set) {
    try {
      client.res.write(frame);
    } catch {
      removeSSEClient(client);
    }
  }
}

// Legacy entry points — preserved verbatim so every existing call site keeps
// working. The legacy `update` / `match_ended` payloads are written as
// DEFAULT (un-named) SSE frames so existing `EventSource.onmessage` listeners
// in MatchControl, ScoreBugOverlay, ScoreBugOverlay2, and PlayerStatsOverlay
// keep receiving them. The typed `score.updated` / `match.ended` events fire
// alongside as named frames for new subscribers.
export function emitMatchUpdate(matchId: string, detail?: Partial<{ scope: string; payload: unknown }>) {
  writeFrame(matchId, "update", { matchId, ...(detail ?? {}) }, false);
  writeFrame(matchId, "score.updated", { matchId, ...(detail ?? {}) }, true);
}

export function emitMatchEnded(matchId: string) {
  writeFrame(matchId, "match_ended", { matchId }, false);
  writeFrame(matchId, "match.ended", { matchId }, true);
  // Close out — no further events for this match.
  const set = clients.get(matchId);
  if (set) {
    for (const client of set) {
      try { client.res.end(); } catch {}
    }
    clients.delete(matchId);
  }
}

// New typed emitters — call from new code paths as flows are migrated. The
// legacy `update` mirror is sent as an un-named frame so existing onmessage
// listeners keep working.
export function emitScoreUpdated(matchId: string, detail: Record<string, unknown>) {
  writeFrame(matchId, "update", { matchId, ...detail }, false);
  writeFrame(matchId, "score.updated", { matchId, ...detail }, true);
}
export function emitClockTick(matchId: string, detail: Record<string, unknown>) {
  writeFrame(matchId, "clock.tick", { matchId, ...detail }, true);
}
export function emitGfxTrigger(matchId: string, detail: Record<string, unknown>) {
  writeFrame(matchId, "gfx.trigger", { matchId, ...detail }, true);
}
export function emitChukkerChanged(matchId: string, detail: Record<string, unknown>) {
  writeFrame(matchId, "chukker.changed", { matchId, ...detail }, true);
  writeFrame(matchId, "update", { matchId, ...detail }, false);
}

export function getClientCount(matchId: string): number {
  return clients.get(matchId)?.size || 0;
}
