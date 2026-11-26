const MAX_EDGE = 1600;
const MAX_BYTES = 1_500_000;

function blobFromCanvas(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.size < 100) reject(new Error("Could not convert that image to WebP."));
      else resolve(blob);
    }, "image/webp", quality);
  });
}

export async function compressToWebp(file: File): Promise<Blob> {
  if (file.size < 100) throw new Error("That file is empty or too small to be a photo.");
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not compress this image.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let quality = 0.82;
  let blob = await blobFromCanvas(canvas, quality);
  while (blob.size > MAX_BYTES && quality > 0.4) {
    quality -= 0.12;
    blob = await blobFromCanvas(canvas, quality);
  }
  if (blob.size > MAX_BYTES) throw new Error("That image is still too large after compression.");
  return blob;
}

export function bindPortfolioUpload(form: HTMLFormElement): void {
  const status = form.querySelector<HTMLElement>("[data-upload-status]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = form.querySelector<HTMLInputElement>('input[type="file"]');
    const file = input?.files?.[0];
    if (!file) return;
    if (status) status.textContent = "Compressing to WebP…";
    try {
      const webp = await compressToWebp(file);
      const body = new FormData(form);
      body.set("file", new File([webp], "portfolio.webp", { type: "image/webp" }));
      const response = await fetch(form.action, { method: "POST", body, credentials: "same-origin" });
      if (response.redirected) {
        window.location.href = response.url;
        return;
      }
      window.location.href = "/artist/dashboard?error=image";
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : "Could not compress that image.";
    }
  });
}
