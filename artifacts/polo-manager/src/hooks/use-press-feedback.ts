import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, MutableRefObject } from "react";

const STORAGE_KEY = "pm_sound_muted";
const PRESS_MS = 700;
const RESULT_MS = 600;

const ASSET_BASE = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL) || "/";
const CLICK_URL = `${ASSET_BASE.replace(/\/$/, "")}/sounds/click.wav`;
const ERROR_URL = `${ASSET_BASE.replace(/\/$/, "")}/sounds/error.wav`;

type AudioCtxCtor = typeof AudioContext;

let sharedCtx: AudioContext | null = null;
const decodedBuffers: Map<string, AudioBuffer> = new Map();
const inflightDecodes: Map<string, Promise<AudioBuffer | null>> = new Map();
const fallbackEls: Map<string, HTMLAudioElement> = new Map();

function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (sharedCtx && sharedCtx.state !== "closed") return sharedCtx;
  const Ctor: AudioCtxCtor | undefined =
    (window as unknown as { AudioContext?: AudioCtxCtor }).AudioContext ||
    (window as unknown as { webkitAudioContext?: AudioCtxCtor }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    sharedCtx = new Ctor();
    return sharedCtx;
  } catch {
    return null;
  }
}

async function loadBuffer(url: string): Promise<AudioBuffer | null> {
  const cached = decodedBuffers.get(url);
  if (cached) return cached;
  const inflight = inflightDecodes.get(url);
  if (inflight) return inflight;
  const ctx = getAudioCtx();
  if (!ctx) return null;
  const p = (async () => {
    try {
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      const decoded = await ctx.decodeAudioData(ab.slice(0));
      decodedBuffers.set(url, decoded);
      return decoded;
    } catch {
      return null;
    } finally {
      inflightDecodes.delete(url);
    }
  })();
  inflightDecodes.set(url, p);
  return p;
}

function playFallback(url: string, volume: number) {
  if (typeof window === "undefined") return;
  let el = fallbackEls.get(url);
  if (!el) {
    el = new Audio(url);
    el.preload = "auto";
    fallbackEls.set(url, el);
  }
  try {
    el.volume = volume;
    el.currentTime = 0;
    void el.play().catch(() => {});
  } catch {
    // best-effort
  }
}

function playSound(url: string, volume: number) {
  const ctx = getAudioCtx();
  if (!ctx) {
    playFallback(url, volume);
    return;
  }
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  const buf = decodedBuffers.get(url);
  if (buf) {
    try {
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = volume;
      src.buffer = buf;
      src.connect(gain).connect(ctx.destination);
      src.start();
      return;
    } catch {
      playFallback(url, volume);
      return;
    }
  }
  // Kick off decode for next time; play fallback so this press isn't silent.
  void loadBuffer(url);
  playFallback(url, volume);
}

export interface PressFeedback {
  isMuted: boolean;
  toggleMute: () => void;
  pulse: (el: HTMLElement | null) => void;
  success: (el: HTMLElement | null) => void;
  error: (el: HTMLElement | null) => void;
  onClickCapture: (e: ReactMouseEvent<HTMLElement>) => void;
  lastPressedRef: MutableRefObject<HTMLElement | null>;
}

const pendingTimeouts: WeakMap<HTMLElement, number> = new WeakMap();

function applyClass(el: HTMLElement | null, cls: string, durationMs: number) {
  if (!el) return;
  const prev = pendingTimeouts.get(el);
  if (prev !== undefined) {
    window.clearTimeout(prev);
    pendingTimeouts.delete(el);
  }
  el.classList.remove("feedback-press", "feedback-success", "feedback-error");
  void el.offsetWidth;
  el.classList.add(cls);
  const id = window.setTimeout(() => {
    el.classList.remove(cls);
    pendingTimeouts.delete(el);
  }, durationMs);
  pendingTimeouts.set(el, id);
}

export function usePressFeedback(enabled: boolean): PressFeedback {
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const mutedRef = useRef(isMuted);
  useEffect(() => {
    mutedRef.current = isMuted;
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const playClick = useCallback(() => {
    if (mutedRef.current) return;
    playSound(CLICK_URL, 0.5);
  }, []);

  const playError = useCallback(() => {
    if (mutedRef.current) return;
    playSound(ERROR_URL, 0.55);
  }, []);

  const pulse = useCallback((el: HTMLElement | null) => {
    applyClass(el, "feedback-press", PRESS_MS);
    playClick();
  }, [playClick]);

  const success = useCallback((el: HTMLElement | null) => {
    applyClass(el, "feedback-success", RESULT_MS);
  }, []);

  const error = useCallback((el: HTMLElement | null) => {
    applyClass(el, "feedback-error", RESULT_MS);
    playError();
  }, [playError]);

  const lastPressedRef = useRef<HTMLElement | null>(null);
  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // Warm up audio buffers at first user gesture (any click) so the very next
  // press has near-zero latency. The initial press itself uses the fallback
  // path (HTMLAudioElement) until decoding completes.
  const warmupDoneRef = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    const warmup = () => {
      if (warmupDoneRef.current) return;
      warmupDoneRef.current = true;
      void loadBuffer(CLICK_URL);
      void loadBuffer(ERROR_URL);
    };
    window.addEventListener("pointerdown", warmup, { once: true, capture: true });
    return () => {
      window.removeEventListener("pointerdown", warmup, { capture: true } as EventListenerOptions);
    };
  }, [enabled]);

  const onClickCapture = useCallback((e: ReactMouseEvent<HTMLElement>) => {
    if (!enabledRef.current) return;
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const btn = target.closest("button") as HTMLButtonElement | null;
    if (!btn) return;
    if (btn.disabled) return;
    if (btn.closest("[data-no-feedback]")) return;
    lastPressedRef.current = btn;
    pulse(btn);
  }, [pulse]);

  return { isMuted, toggleMute, pulse, success, error, onClickCapture, lastPressedRef };
}

// Exported for testing only.
export const __testing = {
  STORAGE_KEY,
  CLICK_URL,
  ERROR_URL,
  PRESS_MS,
  RESULT_MS,
};
