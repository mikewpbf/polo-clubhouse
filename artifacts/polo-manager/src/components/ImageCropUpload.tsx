import { useState, useRef, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut, Check, X, Move, Upload, Image as ImageIcon, RefreshCcw } from "lucide-react";
import { uploadImageFile } from "@/lib/upload";
import { PlayerHeadshot } from "@/components/PlayerHeadshot";

export type CropShape = "circle" | "square" | "portrait";

const SQUARE_SIZE = 256;
const PORTRAIT_W = 240;
const PORTRAIT_H = 320;

function getCropDims(shape: CropShape): { w: number; h: number } {
  if (shape === "portrait") return { w: PORTRAIT_W, h: PORTRAIT_H };
  return { w: SQUARE_SIZE, h: SQUARE_SIZE };
}

function getCroppedBlob(
  image: HTMLImageElement,
  offsetX: number,
  offsetY: number,
  scale: number,
  shape: CropShape,
): Promise<Blob> {
  const { w, h } = getCropDims(shape);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  if (shape === "circle") {
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
    ctx.clip();
  }
  const scaledW = image.naturalWidth * scale;
  const scaledH = image.naturalHeight * scale;
  ctx.drawImage(
    image,
    (w - scaledW) / 2 + offsetX,
    (h - scaledH) / 2 + offsetY,
    scaledW,
    scaledH,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => { if (blob) resolve(blob); else reject(new Error("Canvas toBlob failed")); },
      "image/jpeg", 0.92,
    );
  });
}

const SLIDER_STYLES = `
  .polo-crop-slider::-webkit-slider-runnable-track { background: transparent; height: 0; }
  .polo-crop-slider::-moz-range-track { background: transparent; height: 0; border: none; }
  .polo-crop-slider::-webkit-slider-thumb {
    -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%;
    background: white; border: 2.5px solid #16a34a;
    box-shadow: 0 1px 4px rgba(0,0,0,0.25); cursor: pointer; margin-top: -10px;
  }
  .polo-crop-slider::-moz-range-thumb {
    width: 20px; height: 20px; border-radius: 50%;
    background: white; border: 2.5px solid #16a34a;
    box-shadow: 0 1px 4px rgba(0,0,0,0.25); cursor: pointer;
  }
`;

interface ImageCropUploadProps {
  value: string | null;
  /**
   * Optional original full-resolution upload preserved alongside `value`.
   * When provided AND non-null, clicking the slot opens the cropper
   * pre-loaded with this source image so the user can re-crop without
   * re-uploading. The save callback always provides the latest source URL
   * back so callers can persist it (it stays the same when re-cropping;
   * it becomes a fresh URL when the user uploads a new file).
   */
  sourceValue?: string | null;
  onChange: (url: string, sourceUrl: string | null) => void;
  name?: string;
  shape?: CropShape;
  size?: number;
}

export function ImageCropUpload({
  value,
  sourceValue,
  onChange,
  name,
  shape = "circle",
  size = 96,
}: ImageCropUploadProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The URL we should report back as the source on save. Each new file
  // selection increments `selectionToken` and starts an in-flight upload of
  // the original; save awaits that upload, but only accepts its result if
  // the token still matches (i.e. the user hasn't picked yet another file
  // in the meantime). The promise settles to a tagged result so save can
  // distinguish a successful upload from a failure and refuse to persist
  // the crop without its source — preserving the original alongside the
  // crop is a hard requirement, not best-effort.
  type SourceResult = { ok: true; url: string } | { ok: false; error: Error };
  type SourceState = { token: number; promise: Promise<SourceResult> };
  const sourceRef = useRef<SourceState>({
    token: 0,
    promise: Promise.resolve({ ok: false, error: new Error("no source selected") }),
  });
  const selectionTokenRef = useRef(0);

  const openPicker = () => fileInputRef.current?.click();

  // Click on the slot:
  //  - if we have a saved source URL, open the cropper pre-loaded with it so
  //    the user can re-crop without re-uploading.
  //  - otherwise open the file picker as before.
  const onSlotClick = () => {
    if (sourceValue) {
      const token = ++selectionTokenRef.current;
      sourceRef.current = {
        token,
        promise: Promise.resolve({ ok: true, url: sourceValue } as SourceResult),
      };
      setImageSrc(sourceValue);
      setOffset({ x: 0, y: 0 });
      setScale(1);
      setSaveError(null);
      setModalOpen(true);
    } else {
      openPicker();
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Bump the selection token immediately so any earlier in-flight upload
    // becomes stale and cannot leak into save.
    const token = ++selectionTokenRef.current;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setImageSrc(dataUrl);
      setOffset({ x: 0, y: 0 });
      setScale(1);
      setModalOpen(true);
    };
    reader.readAsDataURL(file);
    // Kick off the upload right away and stash the promise so save can
    // await it. Failures DO block save — preserving the original alongside
    // the crop is required, so we surface the error and let the user retry
    // (Different photo) instead of silently dropping the source URL.
    const promise: Promise<SourceResult> = uploadImageFile(file)
      .then((url) => ({ ok: true as const, url }))
      .catch((err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error("Source image upload failed", error);
        return { ok: false as const, error };
      });
    sourceRef.current = { token, promise };
    setSaveError(null);
    e.target.value = "";
  };

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragStart.current) return;
    setOffset({ x: dragStart.current.ox + (e.clientX - dragStart.current.mx), y: dragStart.current.oy + (e.clientY - dragStart.current.my) });
  }, []);

  const onMouseUp = useCallback(() => { dragStart.current = null; }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => { window.removeEventListener("mousemove", onMouseMove); window.removeEventListener("mouseup", onMouseUp); };
  }, [onMouseMove, onMouseUp]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.min(3, Math.max(0.3, s - e.deltaY * 0.001)));
  };

  const handleSave = async () => {
    if (!imgRef.current || saving) return;
    setSaving(true);
    setSaveError(null);
    // Snapshot the current selection so a "Different photo" click during
    // save cannot swap the source URL out from under us.
    const { token, promise: sourcePromise } = sourceRef.current;
    try {
      // Wait for the original-resolution upload to finish before producing
      // the crop+source pair. This guarantees the persisted source URL
      // matches the file the crop was actually derived from, and lets us
      // refuse to persist if the source upload failed.
      const sourceResult = await sourcePromise;
      // If the user picked yet another file while we were waiting, bail
      // out silently — they'll hit Save again on the new selection.
      if (token !== selectionTokenRef.current) {
        setSaving(false);
        return;
      }
      if (!sourceResult.ok) {
        // Hard requirement: never persist a crop without its source.
        setSaveError("Couldn't upload the original photo. Pick a different photo and try again.");
        setSaving(false);
        return;
      }
      const blob = await getCroppedBlob(imgRef.current, offset.x, offset.y, scale, shape);
      const url = await uploadImageFile(new File([blob], "image.jpg", { type: "image/jpeg" }));
      onChange(url, sourceResult.url);
      setModalOpen(false);
      setImageSrc(null);
    } catch (err) {
      console.error("Crop upload failed", err);
      setSaveError("Couldn't save the cropped photo. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Bumping the token invalidates any in-flight upload so its result
    // can't bleed into a future save.
    selectionTokenRef.current += 1;
    sourceRef.current = {
      token: selectionTokenRef.current,
      promise: Promise.resolve({ ok: false, error: new Error("cancelled") } as SourceResult),
    };
    setModalOpen(false);
    setImageSrc(null);
    setSaveError(null);
  };

  const borderRadius =
    shape === "circle" ? "50%" :
    shape === "portrait" ? "10px" :
    "12px";

  // Trigger button dimensions: portrait shapes render as a vertical rectangle so
  // the placeholder/preview tells the user the saved image is tall, not square.
  const triggerWidth  = shape === "portrait" ? size : size;
  const triggerHeight = shape === "portrait" ? Math.round(size * (PORTRAIT_H / PORTRAIT_W)) : size;

  // Modal preview dimensions follow the same ratio as the saved JPEG.
  const cropDims = getCropDims(shape);

  // Whether the existing slot click triggers a re-crop instead of a fresh
  // upload. Drives the hover-affordance icon so the user knows what to expect.
  const willRecrop = !!sourceValue;

  return (
    <>
      <style>{SLIDER_STYLES}</style>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

      {shape === "circle" ? (
        <button type="button" onClick={onSlotClick} className="relative group focus:outline-none" title={willRecrop ? "Re-crop photo" : "Upload photo"}>
          <PlayerHeadshot url={value} name={name ?? ""} size={size} />
          <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            {willRecrop ? (
              <RefreshCcw className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            ) : (
              <Upload className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        </button>
      ) : (
        <button
          type="button"
          onClick={onSlotClick}
          className="relative overflow-hidden border-2 border-line hover:border-g300 transition-colors cursor-pointer group"
          style={{ width: triggerWidth, height: triggerHeight, borderRadius }}
          title={willRecrop ? "Re-crop photo" : "Upload photo"}
        >
          {value ? (
            <img src={value} alt="Upload" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-g50">
              <ImageIcon className="w-5 h-5 text-ink3" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            {willRecrop ? <RefreshCcw className="w-5 h-5 text-white" /> : <Upload className="w-5 h-5 text-white" />}
          </div>
        </button>
      )}

      {modalOpen && imageSrc && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-96 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Crop photo</h3>
                <p className="text-xs text-gray-500 mt-0.5">Drag to reposition · scroll to zoom</p>
              </div>
              <button type="button" onClick={handleCancel} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-gray-900 flex items-center justify-center py-8 select-none">
              <div
                className="relative overflow-hidden"
                style={{ width: cropDims.w, height: cropDims.h, borderRadius }}
              >
                <div
                  className="absolute inset-0 z-20 pointer-events-none"
                  style={{ borderRadius, boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.6)" }}
                />
                <div className="absolute z-20 bottom-2 right-2 pointer-events-none">
                  <div className="bg-black/50 rounded-md px-1.5 py-1 flex items-center gap-1">
                    <Move className="w-3 h-3 text-white/70" />
                    <span className="text-[10px] text-white/70 font-medium">drag</span>
                  </div>
                </div>
                <div
                  className="absolute inset-0 cursor-grab active:cursor-grabbing"
                  onMouseDown={onMouseDown}
                  onWheel={onWheel}
                >
                  <img
                    ref={imgRef}
                    src={imageSrc}
                    alt="Crop"
                    draggable={false}
                    crossOrigin="anonymous"
                    style={{
                      position: "absolute", left: "50%", top: "50%",
                      transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`,
                      transformOrigin: "center", maxWidth: "none",
                      userSelect: "none", pointerEvents: "none",
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 px-5 py-4">
              <button type="button" onClick={() => setScale((s) => Math.max(0.3, s - 0.1))} className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors flex-shrink-0">
                <ZoomOut className="w-4 h-4 text-gray-700" />
              </button>
              <div className="flex-1 relative flex items-center">
                <div className="absolute inset-0 flex items-center pointer-events-none">
                  <div className="w-full h-2 rounded-full bg-gray-200">
                    <div className="h-full rounded-full bg-green-600" style={{ width: `${((scale - 0.3) / 2.7) * 100}%` }} />
                  </div>
                </div>
                <input
                  type="range" min={30} max={300} value={Math.round(scale * 100)}
                  onChange={(e) => setScale(Number(e.target.value) / 100)}
                  className="polo-crop-slider relative w-full h-2 appearance-none bg-transparent cursor-pointer"
                  style={{ WebkitAppearance: "none" }}
                />
              </div>
              <button type="button" onClick={() => setScale((s) => Math.min(3, s + 0.1))} className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors flex-shrink-0">
                <ZoomIn className="w-4 h-4 text-gray-700" />
              </button>
              <span className="text-xs font-medium text-gray-600 w-10 text-right tabular-nums">{Math.round(scale * 100)}%</span>
            </div>

            {saveError && (
              <div role="alert" className="mx-5 mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {saveError}
              </div>
            )}

            <div className="flex items-center justify-between px-5 pb-5">
              <div className="flex items-center gap-2">
                <button type="button" onClick={handleCancel} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={openPicker}
                  className="px-3 py-2 text-xs font-medium text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors inline-flex items-center gap-1.5"
                  title="Pick a different photo"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Different photo
                </button>
              </div>
              <button
                type="button" onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-green-700 rounded-lg hover:bg-green-800 transition-colors disabled:opacity-60"
              >
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? "Saving…" : "Save photo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
