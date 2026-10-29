/** Turns a photo or PDF into page images (JPEG data URLs) on the device, resized before upload. */
const MAX_SIDE = 1600;
const MAX_PAGES = 4;

function canvasToJpeg(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/jpeg", 0.85);
}

async function imageToDataUrl(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvasToJpeg(canvas);
}

async function pdfToDataUrls(file: Blob): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const out: string[] = [];
  for (let i = 1; i <= Math.min(doc.numPages, MAX_PAGES); i++) {
    const page = await doc.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(2.5, MAX_SIDE / Math.max(base.width, base.height)) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvas, viewport, background: "#ffffff" }).promise;
    out.push(canvasToJpeg(canvas));
  }
  await doc.destroy();
  return out;
}

export async function fileToPages(file: File): Promise<{ pages: string[]; truncated: boolean }> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const pages = await pdfToDataUrls(file);
    return { pages, truncated: false };
  }
  if (!file.type.startsWith("image/")) throw new Error("Choose a photo (JPEG, PNG) or a PDF.");
  return { pages: [await imageToDataUrl(file)], truncated: false };
}

export async function urlToPages(url: string): Promise<string[]> {
  const res = await fetch(url);
  return [await imageToDataUrl(await res.blob())];
}
