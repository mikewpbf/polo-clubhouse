import { Router } from "express";
import { requireAuth } from "../lib/auth";
import net from "node:net";

const router = Router();

function isPrivateOrBlockedHost(hostname: string): boolean {
  const blocked = [
    "localhost", "127.0.0.1", "0.0.0.0", "::1",
    "169.254.169.254", "metadata.google.internal",
  ];
  if (blocked.includes(hostname)) return true;
  if (hostname.endsWith(".internal") || hostname.endsWith(".local")) return true;

  if (net.isIPv4(hostname)) {
    const parts = hostname.split(".").map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 127) return true;
  }

  return false;
}

router.get("/image-proxy", requireAuth, async (req, res) => {
  const url = req.query.url as string;
  if (!url) {
    res.status(400).json({ error: "url query parameter required" });
    return;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      res.status(400).json({ error: "Only HTTPS URLs allowed" });
      return;
    }

    if (isPrivateOrBlockedHost(parsed.hostname)) {
      res.status(403).json({ error: "Blocked host" });
      return;
    }

    const response = await fetch(url, {
      headers: { "Accept": "image/*" },
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });

    if (response.status >= 300 && response.status < 400) {
      res.status(403).json({ error: "Redirects not allowed" });
      return;
    }

    if (!response.ok) {
      res.status(response.status).json({ error: "Upstream error" });
      return;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      res.status(400).json({ error: "Response is not an image" });
      return;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const MAX_SIZE = 10 * 1024 * 1024;
    if (buffer.length > MAX_SIZE) {
      res.status(413).json({ error: "Image too large" });
      return;
    }

    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=3600");
    res.send(buffer);
  } catch {
    res.status(502).json({ error: "Failed to fetch image" });
  }
});

export default router;
