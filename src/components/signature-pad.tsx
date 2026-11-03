"use client";

import { useEffect, useRef, useState } from "react";

/** Batch 90 (Riaan, 3 Nov 2026): sign with the mouse (or a finger on a phone)
 * and type your name below -- instead of uploading a photo of a signature,
 * which students often got wrong. The drawing is posted as a PNG data URL in
 * the hidden field `signatureDrawn` (trimmed, transparent background) and the
 * typed name in `signatureName`; the server saves it like an uploaded
 * signature. */
export default function SignaturePad({
  defaultName = "",
  compact = false,
}: {
  defaultName?: string;
  compact?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [dataUrl, setDataUrl] = useState("");
  const [hasInk, setHasInk] = useState(false);
  const [name, setName] = useState(defaultName);

  // Size the canvas to its box (sharp on high-DPI screens).
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = Math.round(rect.width * dpr);
    c.height = Math.round(rect.height * dpr);
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = "#0b1f4d";
  }, []);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
    const ctx = e.currentTarget.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, 1.1, 0, Math.PI * 2);
    ctx.fillStyle = "#0b1f4d";
    ctx.fill();
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return;
    e.preventDefault();
    const p = point(e);
    const ctx = e.currentTarget.getContext("2d")!;
    const mid = { x: (last.current.x + p.x) / 2, y: (last.current.y + p.y) / 2 };
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.quadraticCurveTo(last.current.x, last.current.y, mid.x, mid.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    setHasInk(true);
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    setHasInk(true);
    setDataUrl(trimmedPng());
  }

  /** The drawing cropped to the ink, with a small margin, transparent background. */
  function trimmedPng(): string {
    const c = canvasRef.current;
    if (!c) return "";
    const ctx = c.getContext("2d")!;
    const { width: w, height: h } = c;
    const px = ctx.getImageData(0, 0, w, h).data;
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (px[(y * w + x) * 4 + 3] > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return "";
    const pad = 8;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(w - 1, maxX + pad);
    maxY = Math.min(h - 1, maxY + pad);
    const out = document.createElement("canvas");
    out.width = maxX - minX + 1;
    out.height = maxY - minY + 1;
    out.getContext("2d")!.drawImage(c, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
    return out.toDataURL("image/png");
  }

  function clear() {
    const c = canvasRef.current;
    if (!c) return;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
    setDataUrl("");
  }

  return (
    <div className="rounded-lg border border-slate-300 bg-white p-3">
      <input type="hidden" name="signatureDrawn" value={dataUrl} />
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-700">Sign here with your mouse (or finger on a phone)</span>
        <button type="button" onClick={clear} className="text-xs font-medium text-slate-500 hover:text-red-600">
          Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        aria-label="Signature pad"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
        className={`mt-1 w-full touch-none rounded-md border border-dashed border-slate-300 bg-slate-50 ${compact ? "h-28" : "h-36"}`}
      />
      <div className="mx-2 -mt-6 mb-4 border-b border-slate-400" aria-hidden />
      <label className="block text-xs font-medium text-slate-600">
        Type your full name below the signature
        <input
          name="signatureName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required={hasInk}
          placeholder="e.g. Thabo Mokoena"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </label>
      <p className="mt-1 text-xs text-slate-500">
        {hasInk ? "Signature captured - it is saved when you save this form." : "Nothing drawn yet."}
      </p>
    </div>
  );
}
