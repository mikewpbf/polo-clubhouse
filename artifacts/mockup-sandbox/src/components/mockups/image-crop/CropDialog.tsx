import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, X, Check, ZoomIn, ZoomOut, Move } from "lucide-react";

const CIRCLE_SIZE = 256;

function getCroppedBlob(
  image: HTMLImageElement,
  offsetX: number,
  offsetY: number,
  scale: number
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = CIRCLE_SIZE;
  canvas.height = CIRCLE_SIZE;
  const ctx = canvas.getContext("2d")!;

  ctx.beginPath();
  ctx.arc(CIRCLE_SIZE / 2, CIRCLE_SIZE / 2, CIRCLE_SIZE / 2, 0, Math.PI * 2);
  ctx.clip();

  const scaledW = image.naturalWidth * scale;
  const scaledH = image.naturalHeight * scale;
  const drawX = (CIRCLE_SIZE - scaledW) / 2 + offsetX;
  const drawY = (CIRCLE_SIZE - scaledH) / 2 + offsetY;
  ctx.drawImage(image, drawX, drawY, scaledW, scaledH);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(URL.createObjectURL(blob!));
    }, "image/jpeg", 0.95);
  });
}

export function CropDialog() {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [croppedUrl, setCroppedUrl] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);

  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openFilePicker = () => fileInputRef.current?.click();

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
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    setOffset({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy });
  }, []);

  const onMouseUp = useCallback(() => {
    dragStart.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => Math.min(3, Math.max(0.3, s - e.deltaY * 0.001)));
  };

  const handleSave = async () => {
    if (!imgRef.current) return;
    const url = await getCroppedBlob(imgRef.current, offset.x, offset.y, scale);
    setCroppedUrl(url);
    setModalOpen(false);
  };

  const handleCancel = () => {
    setModalOpen(false);
    if (!croppedUrl) setImageSrc(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <style>{`
        .crop-slider::-webkit-slider-runnable-track {
          background: transparent;
          height: 0;
        }
        .crop-slider::-moz-range-track {
          background: transparent;
          height: 0;
          border: none;
        }
        .crop-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          border: 2.5px solid #16a34a;
          box-shadow: 0 1px 4px rgba(0,0,0,0.25);
          cursor: pointer;
          margin-top: -10px;
        }
        .crop-slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: white;
          border: 2.5px solid #16a34a;
          box-shadow: 0 1px 4px rgba(0,0,0,0.25);
          cursor: pointer;
        }
      `}</style>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-lg p-8 w-80">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Player Profile</h2>
        <p className="text-xs text-gray-500 mb-6">Upload a headshot for this player</p>

        {/* Avatar + upload button */}
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={openFilePicker}
            className="relative group focus:outline-none"
          >
            <div
              className="w-24 h-24 rounded-full overflow-hidden border-2 border-dashed border-gray-300 group-hover:border-green-500 transition-colors bg-gray-100 flex items-center justify-center"
            >
              {croppedUrl ? (
                <img src={croppedUrl} alt="Headshot" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-gray-400 group-hover:text-green-500 transition-colors">
                  <Upload className="w-6 h-6" />
                  <span className="text-[10px] font-medium">Upload</span>
                </div>
              )}
            </div>
            {croppedUrl && (
              <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <Upload className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
          </button>

          <button
            onClick={openFilePicker}
            className="text-sm font-medium text-green-700 hover:text-green-800 transition-colors"
          >
            {croppedUrl ? "Change photo" : "Upload photo"}
          </button>
          <p className="text-[11px] text-gray-400 text-center">
            JPG, PNG or WEBP · Max 10MB
          </p>
        </div>

        {croppedUrl && (
          <div className="mt-6 pt-6 border-t border-gray-100 flex justify-end gap-2">
            <button className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors">
              Cancel
            </button>
            <button className="px-4 py-2 text-sm font-medium text-white bg-green-700 rounded-lg hover:bg-green-800 transition-colors">
              Save changes
            </button>
          </div>
        )}
      </div>

      {/* Crop Modal */}
      {modalOpen && imageSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-96 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Crop photo</h3>
                <p className="text-xs text-gray-500 mt-0.5">Drag to reposition · scroll to zoom</p>
              </div>
              <button
                onClick={handleCancel}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Crop area */}
            <div className="bg-gray-900 flex items-center justify-center py-8 select-none">
              <div className="relative" style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}>
                {/* Circle ring */}
                <div
                  className="absolute inset-0 z-20 pointer-events-none rounded-full ring-2 ring-white/60"
                />
                {/* Move hint */}
                <div className="absolute z-20 bottom-2 right-2 pointer-events-none">
                  <div className="bg-black/50 rounded-md px-1.5 py-1 flex items-center gap-1">
                    <Move className="w-3 h-3 text-white/70" />
                    <span className="text-[10px] text-white/70 font-medium">drag</span>
                  </div>
                </div>
                {/* Image */}
                <div
                  className="absolute inset-0 overflow-hidden cursor-grab active:cursor-grabbing"
                  style={{ borderRadius: "50%" }}
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
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${scale})`,
                      transformOrigin: "center",
                      maxWidth: "none",
                      userSelect: "none",
                      pointerEvents: "none",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Zoom controls */}
            <div className="flex items-center gap-3 px-5 py-4">
              <button
                onClick={() => setScale((s) => Math.max(0.3, s - 0.1))}
                className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors flex-shrink-0"
              >
                <ZoomOut className="w-4 h-4 text-gray-700" />
              </button>
              <div className="flex-1 relative flex items-center">
                <div className="absolute inset-0 flex items-center pointer-events-none">
                  <div className="w-full h-2 rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-green-600"
                      style={{ width: `${((scale - 0.3) / (3 - 0.3)) * 100}%` }}
                    />
                  </div>
                </div>
                <input
                  type="range"
                  min={30}
                  max={300}
                  value={Math.round(scale * 100)}
                  onChange={(e) => setScale(Number(e.target.value) / 100)}
                  className="crop-slider relative w-full h-2 appearance-none bg-transparent cursor-pointer"
                  style={{ WebkitAppearance: "none" }}
                />
              </div>
              <button
                onClick={() => setScale((s) => Math.min(3, s + 0.1))}
                className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors flex-shrink-0"
              >
                <ZoomIn className="w-4 h-4 text-gray-700" />
              </button>
              <span className="text-xs font-medium text-gray-600 w-10 text-right tabular-nums">{Math.round(scale * 100)}%</span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between px-5 py-4">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-green-700 rounded-lg hover:bg-green-800 transition-colors"
              >
                <Check className="w-4 h-4" />
                Save photo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
