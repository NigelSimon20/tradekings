import { describe, expect, it } from "vitest";

import {
  cityFolderName,
  detectFileType,
  siteFolderName,
  storedFileName,
  titleFromFileName,
} from "@/lib/billboards/photos/files";

const bytes = (...values: number[]) => new Uint8Array([...values, ...new Array(16).fill(0)]);
const text = (value: string) => new TextEncoder().encode(value.padEnd(16, " "));

describe("folder layout", () => {
  it("files each site under its city, named by ID and site", () => {
    expect(cityFolderName("Harare")).toBe("Harare");
    expect(siteFolderName({ id: "BB-001", name: "Samora Machel / Julius Nyerere" })).toBe(
      "BB-001 – Samora Machel Julius Nyerere",
    );
  });

  it("never lets a name escape its folder or break Drive", () => {
    expect(cityFolderName("../../etc")).toBe(".. .. etc");
    expect(siteFolderName({ id: "BB-002", name: 'A:B*C?"D<E>F|G\\H' })).toBe("BB-002 – A B C D E F G H");
    expect(cityFolderName("   ")).toBe("No city recorded");
  });

  it("names files by date and time so a folder lists them in order", () => {
    expect(storedFileName("2026-09-27 1405", "Site photo", "Front view", "jpg")).toBe(
      "2026-09-27 1405 Site photo – Front view.jpg",
    );
    expect(storedFileName("2026-09-27 1405", "Lease agreement", "", "pdf")).toBe(
      "2026-09-27 1405 Lease agreement.pdf",
    );
    const names = [
      storedFileName("2026-09-27 1405", "Site photo", "b", "jpg"),
      storedFileName("2026-01-03 0900", "Site photo", "a", "jpg"),
    ].sort();
    expect(names[0]).toMatch(/^2026-01-03/);
  });

  it("keeps a readable title from the original file name", () => {
    expect(titleFromFileName("IMG_2041_front view.JPG")).toBe("IMG 2041 front view");
  });
});

describe("accepted files", () => {
  it("recognises photos and PDFs by their contents", () => {
    expect(detectFileType(bytes(0xff, 0xd8, 0xff, 0xe0))?.mimeType).toBe("image/jpeg");
    expect(detectFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))?.mimeType).toBe("image/png");
    expect(detectFileType(text("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "))?.mimeType).toBe("image/webp");
    expect(detectFileType(text("%PDF-1.7"))?.mimeType).toBe("application/pdf");
  });

  it("refuses anything else, whatever it is called", () => {
    expect(detectFileType(text("<svg onload=alert(1)>"))).toBeNull();
    expect(detectFileType(text("<!doctype html>"))).toBeNull();
    expect(detectFileType(text("MZ executable"))).toBeNull();
  });
});
