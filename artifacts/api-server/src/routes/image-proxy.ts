import { Router } from "express";
import { requireAuth } from "../lib/auth";
import net from "node:net";
import sharp from "sharp";

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

// Task #121 (step 5): on-the-fly resize / format conversion. Phones request
// `?w=512`, TVs request `?w=2048`, OBS keeps the original. Variants are
// CDN-cacheable because they include the resize args in the URL.
const ALLOWED_FITS = new Set(["cover", "contain", "fill", "inside", "outside"]);
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "avif"]);

function clampInt(v: unknown, min: number, max: number): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = parseInt(String(v), 10);
  if (Number.isNaN(n)) return undefined;
  return Math.max(min, Math.min(max, n));
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

    let buffer: Buffer = Buffer.from(new Uint8Array(await response.arrayBuffer()));
    const MAX_SIZE = 10 * 1024 * 1024;
    if (buffer.length > MAX_SIZE) {
      res.status(413).json({ error: "Image too large" });
      return;
    }

    const w = clampInt(req.query.w, 1, 4096);
    const h = clampInt(req.query.h, 1, 4096);
    const fitRaw = String(req.query.fit ?? "").toLowerCase();
    const fmtRaw = String(req.query.fmt ?? "").toLowerCase();
    const fit = ALLOWED_FITS.has(fitRaw) ? (fitRaw as keyof sharp.FitEnum) : "inside";
    const fmt = ALLOWED_FORMATS.has(fmtRaw) ? fmtRaw : null;

    let outType = contentType;
    if (w || h || fmt) {
      let pipeline = sharp(buffer, { failOn: "none" });
      if (w || h) pipeline = pipeline.resize({ width: w, height: h, fit, withoutEnlargement: true });
      if (fmt === "webp") { pipeline = pipeline.webp({ quality: 82 }); outType = "image/webp"; }
      else if (fmt === "avif") { pipeline = pipeline.avif({ quality: 60 }); outType = "image/avif"; }
      else if (fmt === "png") { pipeline = pipeline.png(); outType = "image/png"; }
      else if (fmt === "jpeg") { pipeline = pipeline.jpeg({ quality: 85 }); outType = "image/jpeg"; }
      buffer = await pipeline.toBuffer();
    }

    res.set("Content-Type", outType);
    res.set("Cache-Control", "public, max-age=86400");
    res.send(buffer);
  } catch {
    res.status(502).json({ error: "Failed to fetch image" });
  }
});

export default router;
