import { AppError } from "./errors";
import type { ImageTag } from "./types";

export const MAX_PORTFOLIO_IMAGES = 12;
export const MIN_IMAGE_BYTES = 100;
export const MAX_IMAGE_BYTES = 1_500_000;

const TAGS: ImageTag[] = ["healed", "fresh", "unspecified"];

export function isWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const riff = String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0, bytes[2] ?? 0, bytes[3] ?? 0);
  const webp = String.fromCharCode(bytes[8] ?? 0, bytes[9] ?? 0, bytes[10] ?? 0, bytes[11] ?? 0);
  return riff === "RIFF" && webp === "WEBP";
}

export function validatePortfolioUpload(bytes: Uint8Array, existingCount: number): void {
  if (existingCount >= MAX_PORTFOLIO_IMAGES) throw new AppError("image-cap");
  if (bytes.length < MIN_IMAGE_BYTES) throw new AppError("image-size");
  if (bytes.length > MAX_IMAGE_BYTES) throw new AppError("image-size");
  if (!isWebp(bytes)) throw new AppError("image-type");
}

export function parseImageTag(value: string): ImageTag {
  if (TAGS.includes(value as ImageTag)) return value as ImageTag;
  throw new AppError("tag");
}

export function validateImageMeta(input: { alt: string; rights: boolean }): { alt: string } {
  const alt = input.alt.trim();
  if (!input.rights) throw new AppError("rights");
  if (alt.length < 3 || alt.length > 200) throw new AppError("alt");
  return { alt };
}
