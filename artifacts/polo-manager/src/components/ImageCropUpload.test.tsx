import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react";

// Mock the upload module before importing the component so the component
// picks up the mocked implementation. We control resolution per-call so we
// can simulate slow uploads and verify save ordering.
const uploadCalls: Array<{
  file: File;
  resolve: (url: string) => void;
  reject: (err: Error) => void;
  promise: Promise<string>;
}> = [];

vi.mock("@/lib/upload", () => ({
  uploadImageFile: vi.fn((file: File) => {
    let resolve!: (url: string) => void;
    let reject!: (err: Error) => void;
    const promise = new Promise<string>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    uploadCalls.push({ file, resolve, reject, promise });
    return promise;
  }),
}));

// Avoid pulling lucide-react / PlayerHeadshot rendering surprises.
vi.mock("@/components/PlayerHeadshot", () => ({
  PlayerHeadshot: ({ url, name }: { url?: string | null; name: string }) =>
    <div data-testid="headshot" data-url={url ?? ""}>{name}</div>,
}));

import { ImageCropUpload } from "./ImageCropUpload";

function makeFile(name: string): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "image/jpeg" });
}

/** Wait one microtask flush so React state from awaited promises commits. */
async function flush() {
  await act(async () => { await Promise.resolve(); });
  await act(async () => { await Promise.resolve(); });
}

describe("ImageCropUpload — source URL preservation", () => {
  beforeEach(() => {
    uploadCalls.length = 0;

    // happy-dom's HTMLCanvasElement doesn't implement toBlob — stub it so
    // getCroppedBlob resolves with a deterministic blob synchronously.
    Object.defineProperty(window.HTMLCanvasElement.prototype, "toBlob", {
      configurable: true,
      writable: true,
      value: function (cb: (b: Blob | null) => void) {
        cb(new Blob([new Uint8Array([9, 9, 9])], { type: "image/jpeg" }));
      },
    });
    // getContext is also missing in happy-dom for canvas — return a no-op
    // 2d context so getCroppedBlob's drawImage path doesn't throw.
    Object.defineProperty(window.HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      writable: true,
      value: () => ({
        beginPath() {},
        arc() {},
        clip() {},
        drawImage() {},
      }),
    });

    // FileReader.readAsDataURL — happy-dom's may be slow / async; stub to
    // fire onload synchronously with a deterministic data URL.
    class FakeFileReader {
      onload: ((ev: { target: { result: string } }) => void) | null = null;
      readAsDataURL() {
        const ev = { target: { result: "data:image/jpeg;base64,AAA=" } };
        // Call asynchronously to mimic the real API.
        queueMicrotask(() => this.onload?.(ev));
      }
    }
    (window as unknown as { FileReader: unknown }).FileReader = FakeFileReader;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("re-crop: opens with existing source and emits the same source URL on save", async () => {
    const onChange = vi.fn();
    render(
      <ImageCropUpload
        value="/api/storage/cropped.jpg"
        sourceValue="/api/storage/original.jpg"
        onChange={onChange}
        shape="square"
      />,
    );

    // Click the slot — should open the modal pre-loaded with the source,
    // not trigger a file picker / new upload.
    fireEvent.click(screen.getAllByRole("button")[0]);
    await flush();

    expect(uploadCalls.length).toBe(0);
    const cropImg = await screen.findByAltText("Crop");
    expect(cropImg.getAttribute("src")).toBe("/api/storage/original.jpg");

    // Click Save — the only upload should be the new crop; source URL
    // passed to onChange should be the original we opened with.
    fireEvent.click(screen.getByText("Save photo"));
    await flush();

    expect(uploadCalls.length).toBe(1);
    uploadCalls[0].resolve("/api/storage/new-crop.jpg");
    await flush();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      "/api/storage/new-crop.jpg",
      "/api/storage/original.jpg",
    );
  });

  it("save() awaits the in-flight source upload before persisting (no null source leak)", async () => {
    const onChange = vi.fn();
    render(
      <ImageCropUpload value={null} sourceValue={null} onChange={onChange} shape="square" />,
    );

    // Pick a file. The component starts uploading the original immediately.
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [makeFile("orig.jpg")], configurable: true });
    fireEvent.change(input);
    await flush();

    // Source upload kicked off; not yet resolved.
    expect(uploadCalls.length).toBe(1);

    // User clicks Save BEFORE the source upload resolves.
    fireEvent.click(screen.getByText("Save photo"));
    await flush();

    // No onChange yet — save is awaiting the source upload.
    expect(onChange).not.toHaveBeenCalled();

    // Resolve the source upload first.
    uploadCalls[0].resolve("/api/storage/source.jpg");
    await flush();

    // Now the crop upload should have been issued.
    expect(uploadCalls.length).toBe(2);
    uploadCalls[1].resolve("/api/storage/crop.jpg");
    await flush();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      "/api/storage/crop.jpg",
      "/api/storage/source.jpg",
    );
  });

  it("save is BLOCKED when source upload fails — onChange not called, error surfaced", async () => {
    const onChange = vi.fn();
    render(
      <ImageCropUpload value={null} sourceValue={null} onChange={onChange} shape="square" />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [makeFile("orig.jpg")], configurable: true });
    fireEvent.change(input);
    await flush();
    expect(uploadCalls.length).toBe(1);

    // Source upload fails.
    uploadCalls[0].reject(new Error("network"));
    await flush();

    // User clicks Save.
    fireEvent.click(screen.getByText("Save photo"));
    await flush();

    // No crop upload was issued — save short-circuited.
    expect(uploadCalls.length).toBe(1);
    // onChange must NOT have fired with a missing source.
    expect(onChange).not.toHaveBeenCalled();
    // The user gets actionable feedback.
    expect(screen.getByRole("alert").textContent).toMatch(/original photo/i);
    // Modal stays open so they can retry with a different photo.
    expect(screen.queryByText("Save photo")).not.toBeNull();
  });

  it("'Different photo' then save uses the second file's source URL, not the first", async () => {
    const onChange = vi.fn();
    render(
      <ImageCropUpload value={null} sourceValue={null} onChange={onChange} shape="square" />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    // First file selection.
    Object.defineProperty(input, "files", { value: [makeFile("first.jpg")], configurable: true });
    fireEvent.change(input);
    await flush();
    expect(uploadCalls.length).toBe(1); // first source upload kicked off

    // User clicks "Different photo" and picks a second file BEFORE first
    // upload resolves.
    Object.defineProperty(input, "files", { value: [makeFile("second.jpg")], configurable: true });
    fireEvent.change(input);
    await flush();
    expect(uploadCalls.length).toBe(2); // second source upload kicked off

    // Resolve them in REVERSE order so the stale first one finishes last.
    uploadCalls[1].resolve("/api/storage/second-source.jpg");
    await flush();
    uploadCalls[0].resolve("/api/storage/first-source.jpg");
    await flush();

    // Save.
    fireEvent.click(screen.getByText("Save photo"));
    await flush();

    // A crop upload was issued.
    const cropCall = uploadCalls[2];
    expect(cropCall).toBeDefined();
    cropCall.resolve("/api/storage/second-crop.jpg");
    await flush();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      "/api/storage/second-crop.jpg",
      "/api/storage/second-source.jpg",
    );
  });
});
