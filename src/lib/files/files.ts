import type { Billboard } from "@/lib/billboards/types";

/**
 * How uploaded billboard files are named and filed, and which files are
 * accepted. Pure, so the folder layout is pinned down by tests:
 *
 *   Billboard Photos / Harare / BB-001 – Samora Machel / 2026-09-27 1405 Site photo – Front view.jpg
 *
 * Names start with the date and time, so a site's folder lists its pictures in
 * the order they were taken.
 */

/** Characters Drive, Windows and macOS disagree about, and control characters. */
/** A name that is safe as a Drive or disk folder or file name. */
export function folderName(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80)
    .trim();
}

export function cityFolderName(city: string): string {
  return folderName(city) || "No city recorded";
}

export function siteFolderName(billboard: Pick<Billboard, "id" | "name">): string {
  const name = folderName(billboard.name);
  return name ? `${billboard.id} – ${name}` : billboard.id;
}

/** `2026-09-27 1405 Site photo – Front view.jpg` */
/** `2026-09-27 140512` in the app's timezone, so a folder lists files in the order they were added. */
export function fileStamp(timezone: string, at = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}${part("minute")}${part("second")}`;
}

export function storedFileName(stamp: string, category: string, title: string, extension: string): string {
  const label = folderName(title);
  return `${stamp} ${folderName(category)}${label ? ` – ${label}` : ""}.${extension}`;
}

export interface AcceptedType {
  mimeType: string;
  extension: string;
  isImage: boolean;
}

/** Photos are resized in the browser first, so this is generous for them. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/**
 * Identifies a file from its first bytes rather than its name or the type the
 * browser claims, so a script renamed to `.jpg` is refused. Only photos and
 * PDFs are accepted.
 */
export function detectFileType(bytes: Uint8Array): AcceptedType | null {
  const starts = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
  const ascii = (from: number, text: string) =>
    [...text].every((character, index) => bytes[from + index] === character.charCodeAt(0));

  if (starts(0xff, 0xd8, 0xff)) return { mimeType: "image/jpeg", extension: "jpg", isImage: true };
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) {
    return { mimeType: "image/png", extension: "png", isImage: true };
  }
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return { mimeType: "image/webp", extension: "webp", isImage: true };
  if (ascii(0, "%PDF-")) return { mimeType: "application/pdf", extension: "pdf", isImage: false };
  return null;
}

/** Uploaded files are served by the tracker, so they need no public sharing in Drive. */
export function filePreviewUrl(file: { id: string }): string {
  return `/api/billboards/files/${encodeURIComponent(file.id)}`;
}

/** The part of an uploaded file's name worth keeping as its title. */
export function titleFromFileName(name: string): string {
  return folderName(name.replace(/\.[a-z0-9]{1,5}$/i, "").replace(/[_]+/g, " "));
}
