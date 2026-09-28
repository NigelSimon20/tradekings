import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// The service is server-only; in a test there is no client bundle to protect.
vi.mock("server-only", () => ({}));

/**
 * Uploads end to end through the real service, on the sample-data setup: the
 * file is checked, filed as City / Site, recorded against the billboard and
 * readable again for previews.
 */

let directory: string;
let services: typeof import("@/lib/services/billboards");

// Just enough of each format for the content check; the store never decodes them.
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(64).fill(7)]);
const PDF = new TextEncoder().encode("%PDF-1.7\n% sample lease\n");
const HTML_AS_JPG = new TextEncoder().encode("<html><script>alert(1)</script></html>");

beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "billboard-uploads-"));
  process.env.LOCAL_BILLBOARDS_FILE = path.join(directory, "billboards.json");
  process.env.LOCAL_BILLBOARDS_UPLOADS_DIR = path.join(directory, "uploads");
  delete process.env.GOOGLE_BILLBOARDS_SHEET_ID;
  delete process.env.GOOGLE_BILLBOARDS_PHOTOS_FOLDER_ID;
  services = await import("@/lib/services/billboards");
});

afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe("uploading billboard files", () => {
  it("files a photo under City / Site, named by date so the folder sorts in order", async () => {
    const saved = await services.uploadBillboardFile(
      { billboardId: "BB-001", category: "Site photo", title: "Front view", url: "", documentDate: null },
      { name: "IMG_2041.jpg", bytes: JPEG },
      "nyasha@example.com",
    );

    expect(saved).toMatchObject({ title: "Front view", mimeType: "image/jpeg", addedBy: "nyasha@example.com" });
    expect(saved.storedFileId).toMatch(
      /^Harare\/BB-001 – Samora Machel Julius Nyerere\/\d{4}-\d{2}-\d{2} \d{6} Site photo – Front view\.jpg$/,
    );

    const folder = path.join(directory, "uploads", "Harare", "BB-001 – Samora Machel Julius Nyerere");
    expect(await readdir(folder)).toHaveLength(1);

    const profile = await services.getBillboardProfile("BB-001");
    expect(profile?.files.map((file) => file.id)).toContain(saved.id);
    expect(profile?.billboard.computed.coverPhotoId).toBe(saved.id);
    expect(profile?.activity[0]).toMatchObject({ action: "Photo uploaded", by: "nyasha@example.com" });
  });

  it("keeps the original name as the title when none is given, and accepts PDFs", async () => {
    const saved = await services.uploadBillboardFile(
      { billboardId: "BB-002", category: "Lease agreement", title: "", url: "", documentDate: "2025-01-01" },
      { name: "signed_lease 2025.pdf", bytes: PDF },
      "",
    );
    expect(saved).toMatchObject({ title: "signed lease 2025", mimeType: "application/pdf" });
    expect(saved.storedFileId.endsWith("Lease agreement – signed lease 2025.pdf")).toBe(true);
  });

  it("gives back the file for previews, typed by its contents", async () => {
    const saved = await services.uploadBillboardFile(
      { billboardId: "BB-003", category: "Site photo", title: "", url: "", documentDate: null },
      { name: "x.jpg", bytes: JPEG },
      "",
    );
    const file = await services.readBillboardFile(saved.id);
    expect(file?.mimeType).toBe("image/jpeg");
    expect(Array.from(file!.bytes)).toEqual(Array.from(JPEG));
  });

  it("refuses a file that only claims to be a photo", async () => {
    await expect(
      services.uploadBillboardFile(
        { billboardId: "BB-001", category: "Site photo", title: "", url: "", documentDate: null },
        { name: "photo.jpg", bytes: HTML_AS_JPG },
        "",
      ),
    ).rejects.toThrow(/Only photos/);
  });

  it("refuses files that are too large or for billboards that do not exist", async () => {
    const huge = new Uint8Array(5 * 1024 * 1024);
    huge.set(JPEG);
    await expect(
      services.uploadBillboardFile(
        { billboardId: "BB-001", category: "Site photo", title: "", url: "", documentDate: null },
        { name: "big.jpg", bytes: huge },
        "",
      ),
    ).rejects.toThrow(/larger than 4 MB/);
    await expect(
      services.uploadBillboardFile(
        { billboardId: "BB-999", category: "Site photo", title: "", url: "", documentDate: null },
        { name: "x.jpg", bytes: JPEG },
        "",
      ),
    ).rejects.toThrow(/not found/);
  });

  it("only serves files recorded against a billboard", async () => {
    expect(await services.readBillboardFile("not-a-record")).toBeNull();
    // A pasted link has no stored file to serve.
    const { data } = await services.loadBillboards();
    const linked = data.files.find((file) => !file.storedFileId)!;
    expect(await services.readBillboardFile(linked.id)).toBeNull();
  });

  it("stops serving a file once it is removed, but keeps the record", async () => {
    const saved = await services.uploadBillboardFile(
      { billboardId: "BB-004", category: "Site photo", title: "", url: "", documentDate: null },
      { name: "x.jpg", bytes: JPEG },
      "",
    );
    await services.removeFile(saved.id, "admin@example.com");
    expect(await services.readBillboardFile(saved.id)).toBeNull();
    const { data } = await services.loadBillboards();
    expect(data.files.find((file) => file.id === saved.id)?.removed).toBe(true);
  });
});

describe("the local upload folder", () => {
  it("never reads outside itself", async () => {
    const { LocalPhotoStore } = await import("@/lib/billboards/photos/local-store");
    const store = new LocalPhotoStore(path.join(directory, "uploads"));
    await expect(store.read("../billboards.json")).rejects.toThrow(/not in the uploads folder/);
    await expect(store.read("/etc/passwd")).rejects.toThrow(/not in the uploads folder/);
  });
});
