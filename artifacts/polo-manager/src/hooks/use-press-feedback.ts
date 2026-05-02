import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, MutableRefObject } from "react";

const STORAGE_KEY = "pm_sound_muted";
const PRESS_MS = 700;
const RESULT_MS = 600;

type AudioCtxCtor = typeof AudioContext;

let sharedCtx: AudioContext | null = null;

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

function playTone(freq: number, durationMs: number, type: OscillatorType, volume: number) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.02);
  } catch {
    // Audio failures are non-fatal
  }
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
    playTone(880, 70, "square", 0.045);
  }, []);

  const playError = useCallback(() => {
    if (mutedRef.current) return;
    playTone(220, 160, "sawtooth", 0.07);
    window.setTimeout(() => playTone(160, 200, "sawtooth", 0.07), 90);
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
