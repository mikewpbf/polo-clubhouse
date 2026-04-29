import type { Response } from "express";

type SSEClient = {
  res: Response;
  matchId: string;
};

const clients = new Map<string, Set<SSEClient>>();

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

export function emitMatchUpdate(matchId: string) {
  const set = clients.get(matchId);
  if (!set || set.size === 0) return;
  const payload = `data: {"type":"update"}\n\n`;
  for (const client of set) {
    try {
      client.res.write(payload);
    } catch {
      removeSSEClient(client);
    }
  }
}

export function emitMatchEnded(matchId: string) {
  const set = clients.get(matchId);
  if (!set || set.size === 0) return;
  const payload = `data: {"type":"match_ended"}\n\n`;
  for (const client of set) {
    try {
      client.res.write(payload);
      client.res.end();
    } catch {}
  }
  clients.delete(matchId);
}

export function getClientCount(matchId: string): number {
  return clients.get(matchId)?.size || 0;
}
