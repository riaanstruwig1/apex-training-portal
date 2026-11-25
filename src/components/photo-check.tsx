"use client";

import { useState } from "react";

type Result = { ok: boolean; notes: string[] } | null;

/**
 * Batch 107 (Riaan, 25 Nov 2026): the profile photo is compulsory and must be
 * a passport-type photo on a white background. This checks the chosen image
 * in the browser and tells the person straight away whether it looks
 * suitable -- light/white plain background, upright (portrait), sharp enough
 * -- with tips if not. It is guidance: a photo with warnings can still be
 * used, the CFI sees it on the profile.
 */
async function checkPhoto(file: File): Promise<Result> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const notes: string[] = [];
    const w = img.naturalWidth, h = img.naturalHeight;
    if (w < 300 || h < 300) notes.push(`The photo is small (${w} x ${h}). Use a sharper photo, at least 600 pixels high.`);
    if (w > h * 1.05) notes.push("The photo is wider than it is tall. Use an upright (portrait) passport-style photo.");
    const S = 120;
    const c = document.createElement("canvas");
    c.width = S;
    c.height = Math.round((S * h) / w);
    const ctx = c.getContext("2d");
    if (!ctx) return { ok: notes.length === 0, notes };
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    // Background = the outer band: top strip and both side strips.
    let n = 0, bright = 0, sat = 0, varSum = 0;
    const lum: number[] = [];
    const band = Math.max(4, Math.round(c.width * 0.1));
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const inBand = y < band || x < band || x >= c.width - band;
        if (!inBand || y > c.height * 0.75) continue; // shoulders at the bottom are not background
        const i = (y * c.width + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const L = 0.299 * r + 0.587 * g + 0.114 * b;
        lum.push(L);
        bright += L;
        sat += Math.max(r, g, b) - Math.min(r, g, b);
        n++;
      }
    }
    const avg = bright / n;
    for (const L of lum) varSum += (L - avg) ** 2;
    const sd = Math.sqrt(varSum / n);
    const avgSat = sat / n;
    if (avg < 185) notes.push("The background is not white/light enough. Stand in front of a plain white wall in good light.");
    else if (avgSat > 40) notes.push("The background looks coloured. Use a plain white background.");
    if (sd > 38) notes.push("The background is busy (not plain). Stand in front of a plain white wall, nothing behind you.");
    return { ok: notes.length === 0, notes };
  } catch {
    return { ok: false, notes: ["This image could not be read. Use a JPG or PNG photo."] };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function PhotoCheck({
  inputId = "profilePictureFile",
  name = "profilePictureFile",
  required = false,
  className,
}: {
  inputId?: string;
  name?: string;
  required?: boolean;
  className?: string;
}) {
  const [result, setResult] = useState<Result>(null);
  const [checking, setChecking] = useState(false);
  return (
    <div>
      <input
        id={inputId}
        name={name}
        type="file"
        required={required}
        accept="image/jpeg,image/png,image/webp"
        className={className}
        onChange={async (e) => {
          const f = e.currentTarget.files?.[0];
          setResult(null);
          if (!f) return;
          setChecking(true);
          setResult(await checkPhoto(f));
          setChecking(false);
        }}
      />
      <p className="mt-1 text-xs text-slate-500">
        Passport-type photo: head and shoulders, facing the camera, on a plain <strong>white background</strong>.
      </p>
      {checking && <p className="mt-1 text-xs text-slate-500">Checking the photo...</p>}
      {result?.ok && (
        <p className="mt-1 rounded bg-green-50 px-2 py-1 text-xs font-medium text-green-800">
          ✓ Looks suitable: plain light background, upright photo.
        </p>
      )}
      {result && !result.ok && (
        <div className="mt-1 rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
          <p className="font-semibold">This photo may not be accepted for your licence:</p>
          <ul className="ml-4 list-disc">
            {result.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <p className="mt-1">You can still use it, but a better photo now saves time later.</p>
        </div>
      )}
    </div>
  );
}
