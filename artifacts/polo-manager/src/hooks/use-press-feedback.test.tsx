import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen, cleanup } from "@testing-library/react";
import { useEffect } from "react";
import { usePressFeedback, __testing } from "./use-press-feedback";

const { STORAGE_KEY, PRESS_MS, RESULT_MS } = __testing;

interface HarnessProps {
  enabled?: boolean;
  onMount?: (api: ReturnType<typeof usePressFeedback>) => void;
}

function Harness({ enabled = true, onMount }: HarnessProps) {
  const api = usePressFeedback(enabled);
  useEffect(() => {
    onMount?.(api);
  });
  return (
    <div data-testid="root" onClickCapture={api.onClickCapture}>
      <button data-testid="action">Score</button>
      <div data-no-feedback>
        <button data-testid="excluded">Copy URL</button>
      </div>
      <button
        data-testid="mute"
        aria-pressed={api.isMuted}
        onClick={api.toggleMute}
      >
        mute
      </button>
    </div>
  );
}

describe("usePressFeedback", () => {
  let playSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();

    // Stub HTMLAudioElement.play (used as fallback when AudioContext is absent
    // in happy-dom). vi.fn returns a resolved Promise so we can spy on calls.
    playSpy = vi.fn(() => Promise.resolve());
    // happy-dom defines HTMLMediaElement; stub play.
    Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
      configurable: true,
      writable: true,
      value: playSpy,
    });
    Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    // No AudioContext in happy-dom, which is fine — the hook falls back to
    // HTMLAudioElement automatically. Make sure none is present.
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
    delete (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext;
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("applies feedback-press to clicked button and removes it after the press window", () => {
    render(<Harness />);
    const btn = screen.getByTestId("action");

    act(() => {
      btn.click();
    });
    expect(btn.classList.contains("feedback-press")).toBe(true);

    act(() => {
      vi.advanceTimersByTime(PRESS_MS + 10);
    });
    expect(btn.classList.contains("feedback-press")).toBe(false);
  });

  it("does NOT apply feedback to buttons inside [data-no-feedback]", () => {
    render(<Harness />);
    const btn = screen.getByTestId("excluded");

    act(() => {
      btn.click();
    });
    expect(btn.classList.contains("feedback-press")).toBe(false);
  });

  it("does NOT apply feedback when the hook is disabled (e.g. GFX mode)", () => {
    render(<Harness enabled={false} />);
    const btn = screen.getByTestId("action");

    act(() => {
      btn.click();
    });
    expect(btn.classList.contains("feedback-press")).toBe(false);
  });

  it("plays a sound on click and skips audio when muted, persisting mute in localStorage", () => {
    let api: ReturnType<typeof usePressFeedback> | undefined;
    render(<Harness onMount={(a) => { api = a; }} />);
    const btn = screen.getByTestId("action");

    act(() => {
      btn.click();
    });
    expect(playSpy).toHaveBeenCalledTimes(1);

    // Toggle mute via the hook's API.
    act(() => {
      api!.toggleMute();
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("1");

    act(() => {
      btn.click();
    });
    // Still 1 — second click was muted.
    expect(playSpy).toHaveBeenCalledTimes(1);
  });

  it("restores mute state from localStorage on mount (default unmuted)", () => {
    // Default — nothing stored.
    let api: ReturnType<typeof usePressFeedback> | undefined;
    const { unmount } = render(<Harness onMount={(a) => { api = a; }} />);
    expect(api!.isMuted).toBe(false);
    unmount();

    window.localStorage.setItem(STORAGE_KEY, "1");
    let api2: ReturnType<typeof usePressFeedback> | undefined;
    render(<Harness onMount={(a) => { api2 = a; }} />);
    expect(api2!.isMuted).toBe(true);
  });

  it("success() applies the feedback-success class for the result window", () => {
    let api: ReturnType<typeof usePressFeedback> | undefined;
    render(<Harness onMount={(a) => { api = a; }} />);
    const btn = screen.getByTestId("action");

    act(() => {
      api!.success(btn);
    });
    expect(btn.classList.contains("feedback-success")).toBe(true);

    act(() => {
      vi.advanceTimersByTime(RESULT_MS + 10);
    });
    expect(btn.classList.contains("feedback-success")).toBe(false);
  });

  it("error() applies the feedback-error class and plays the error sound (when not muted)", () => {
    let api: ReturnType<typeof usePressFeedback> | undefined;
    render(<Harness onMount={(a) => { api = a; }} />);
    const btn = screen.getByTestId("action");

    act(() => {
      api!.error(btn);
    });
    expect(btn.classList.contains("feedback-error")).toBe(true);
    expect(playSpy).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(RESULT_MS + 10);
    });
    expect(btn.classList.contains("feedback-error")).toBe(false);
  });

  it("rapid repeat presses extend the animation rather than cutting off early", () => {
    render(<Harness />);
    const btn = screen.getByTestId("action");

    act(() => {
      btn.click();
    });
    act(() => {
      vi.advanceTimersByTime(PRESS_MS / 2);
    });
    expect(btn.classList.contains("feedback-press")).toBe(true);

    // Press again partway through.
    act(() => {
      btn.click();
    });
    // Advance just past when the FIRST timeout would have fired.
    act(() => {
      vi.advanceTimersByTime(PRESS_MS / 2 + 10);
    });
    // Class should still be present because the second click reset the timer.
    expect(btn.classList.contains("feedback-press")).toBe(true);

    act(() => {
      vi.advanceTimersByTime(PRESS_MS);
    });
    expect(btn.classList.contains("feedback-press")).toBe(false);
  });
});
