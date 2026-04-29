import { useState, useRef, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut, Check, X, Move, Upload, Image as ImageIcon } from "lucide-react";
import { uploadImageFile } from "@/lib/upload";
import { PlayerHeadshot } from "@/components/PlayerHeadshot";

const CROP_SIZE = 256;

function getCroppedBlob(
  image: HTMLImageElement,
  offsetX: number,
  offsetY: number,
  scale: number,
  cropShape: "circle" | "square"
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CROP_SIZE;
  canvas.height = CROP_SIZE;
  const ctx = canvas.getContext("2d")!;
  if (cropShape === "circle") {
    ctx.beginPath();
    ctx.arc(CROP_SIZE / 2, CROP_SIZE / 2, CROP_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
  }
  const scaledW = image.naturalWidth * scale;
  const scaledH = image.naturalHeight * scale;
  ctx.drawImage(image, (CROP_SIZE - scaledW) / 2 + offsetX, (CROP_SIZE - scaledH) / 2 + offsetY, scaledW, scaledH);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => { if (blob) resolve(blob); else reject(new Error("Canvas toBlob failed")); },
      "image/jpeg", 0.92
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
  onChange: (url: string) => void;
  name?: string;
  shape?: "circle" | "square";
  size?: number;
}

export function ImageCropUpload({
  value,
  onChange,
  name,
  shape = "circle",
  size = 96,
}: ImageCropUploadProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => fileInputRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImageSrc(ev.target?.result as string);
      setOffset({ x: 0, y: 0 });
      setScale(1);
      setModalOpen(true);
    };
    reader.readAsDataURL(file);
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
    try {
      const blob = await getCroppedBlob(imgRef.current, offset.x, offset.y, scale, shape);
      const url = await uploadImageFile(new File([blob], "image.jpg", { type: "image/jpeg" }));
      onChange(url);
      setModalOpen(false);
    } catch (err) {
      console.error("Crop upload failed", err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => { setModalOpen(false); setImageSrc(null); };

  const borderRadius = shape === "circle" ? "50%" : "12px";

  return (
    <>
      <style>{SLIDER_STYLES}</style>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />

      {shape === "circle" ? (
        <button type="button" onClick={openPicker} className="relative group focus:outline-none">
          <PlayerHeadshot url={value} name={name ?? ""} size={size} />
          <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <Upload className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </button>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          className="relative overflow-hidden border-2 border-line hover:border-g300 transition-colors cursor-pointer group"
          style={{ width: size, height: size, borderRadius }}
        >
          {value ? (
            <img src={value} alt="Upload" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-g50">
              <ImageIcon className="w-5 h-5 text-ink3" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Upload className="w-5 h-5 text-white" />
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
                style={{ width: CROP_SIZE, height: CROP_SIZE, borderRadius }}
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

            <div className="flex items-center justify-between px-5 pb-5">
              <button type="button" onClick={handleCancel} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors">
                Cancel
              </button>
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
