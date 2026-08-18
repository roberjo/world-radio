import type { Station } from '../api/types.ts';
import { formatTags } from './format.ts';

const WIDTH = 1200;
const HEIGHT = 630;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    let settled = false;
    const finish = (result: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    // crossOrigin='anonymous' means the load itself fails cleanly (onerror) for
    // favicon hosts that don't send CORS headers, instead of silently tainting the
    // canvas and only failing later when we try to export it.
    img.crossOrigin = 'anonymous';
    img.onload = () => finish(img);
    img.onerror = () => finish(null);
    img.src = src;
    setTimeout(() => finish(null), 4000);
  });
}

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let result = text;
  while (result.length > 1 && ctx.measureText(result + '…').width > maxWidth) {
    result = result.slice(0, -1);
  }
  return result + '…';
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function renderNowPlayingCard(station: Station, shareUrl: string): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // Background
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, '#0a0a0f');
  bg.addColorStop(1, '#1a1a2e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Wordmark
  ctx.fillStyle = '#f59e0b';
  ctx.font = '600 28px -apple-system, "Segoe UI", sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('📻 WORLD RADIO', 64, 76);

  // Favicon or fallback glyph, in a circle
  const favicon = await loadImage(station.favicon);
  const circleX = 64 + 60;
  const circleY = 220;
  const circleR = 60;
  ctx.save();
  ctx.beginPath();
  ctx.arc(circleX, circleY, circleR, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.fill();
  ctx.clip();
  if (favicon) {
    ctx.drawImage(favicon, circleX - circleR, circleY - circleR, circleR * 2, circleR * 2);
  } else {
    ctx.font = '56px -apple-system, "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📻', circleX, circleY + 20);
    ctx.textAlign = 'left';
  }
  ctx.restore();

  // Station name
  const textX = 64 + 150;
  ctx.fillStyle = '#e5e7eb';
  ctx.font = '700 56px -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(truncate(ctx, station.name.trim(), WIDTH - textX - 64), textX, 200);

  // Country + tags
  ctx.fillStyle = '#9ca3af';
  ctx.font = '400 28px -apple-system, "Segoe UI", sans-serif';
  const tags = formatTags(station.tags);
  const subtitle = [station.country, ...tags.slice(0, 2)].filter(Boolean).join('  ·  ');
  ctx.fillText(truncate(ctx, subtitle, WIDTH - textX - 64), textX, 244);

  // Divider
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(64, 380);
  ctx.lineTo(WIDTH - 64, 380);
  ctx.stroke();

  // "Now playing on" caption
  ctx.fillStyle = '#9ca3af';
  ctx.font = '400 24px -apple-system, "Segoe UI", sans-serif';
  ctx.fillText('Now playing on World Radio', 64, 440);

  // Tune-in link pill
  ctx.font = '600 24px -apple-system, "Segoe UI", sans-serif';
  const linkText = truncate(ctx, shareUrl.replace(/^https?:\/\//, ''), WIDTH - 128);
  const pillWidth = ctx.measureText(linkText).width + 48;
  roundedRect(ctx, 64, 480, pillWidth, 56, 28);
  ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
  ctx.fill();
  ctx.fillStyle = '#f59e0b';
  ctx.fillText(linkText, 88, 516);

  return canvas;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/** Shares (mobile share sheet, when available) or downloads the now-playing card.
 *  Returns false only if generating/exporting the image itself failed. */
export async function shareNowPlayingCard(station: Station, shareUrl: string): Promise<boolean> {
  let canvas: HTMLCanvasElement;
  let blob: Blob | null;
  try {
    canvas = await renderNowPlayingCard(station, shareUrl);
    blob = await canvasToBlob(canvas);
  } catch {
    return false;
  }
  if (!blob) return false;

  const fileName = `${station.name.trim().replace(/[^\w\- ]+/g, '').slice(0, 60) || 'now-playing'}.png`;
  const file = new File([blob], fileName, { type: 'image/png' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: station.name, text: `Now playing on World Radio: ${station.name}` });
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return true; // user cancelled — not a failure
      // fall through to download
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
