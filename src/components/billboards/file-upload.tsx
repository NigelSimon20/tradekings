"use client";

import { useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { UploadIcon } from "@/components/ui/icons";
import { FILE_CATEGORIES } from "@/lib/billboards/types";
import { postForm, useApiAction } from "@/lib/ui/use-api-action";

/** Longest side of an uploaded photo. Plenty for a billboard, small enough to upload on a phone. */
const MAX_PHOTO_SIDE = 2000;

/**
 * Shrinks a photo in the browser before it is sent: turned the right way up,
 * at most 2000px, saved as JPEG. Re-drawing it also drops the camera's hidden
 * details, such as where the phone was when it was taken.
 */
async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The photo could not be read."))), "image/jpeg", 0.85),
  );
}

/**
 * Uploads photos and documents into the billboard's folder in the Shared drive
 * (City / Site). Several can be chosen at once; they go up one at a time.
 */
export function FileUpload({ billboardId }: { billboardId: string }) {
  const { busy, result, run } = useApiAction();
  const [progress, setProgress] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const picker = form.elements.namedItem("files") as HTMLInputElement | null;
    const files = Array.from(picker?.files ?? []);
    if (!files.length) return;

    const details = new FormData(form);
    const outcome = await run("upload", async () => {
      for (const [position, file] of files.entries()) {
        setProgress(`Uploading ${position + 1} of ${files.length}…`);
        const isPhoto = file.type.startsWith("image/");
        let body: Blob = file;
        if (isPhoto) {
          try {
            body = await shrinkPhoto(file);
          } catch {
            throw new Error(
              `“${file.name}” could not be opened in this browser. Save it as a JPG (on an iPhone, set Camera → Formats → Most Compatible) and try again.`,
            );
          }
        }

        const payload = new FormData();
        payload.set("billboardId", billboardId);
        payload.set("category", String(details.get("category") ?? ""));
        payload.set("documentDate", String(details.get("documentDate") ?? ""));
        // One title for several files would give them all the same name.
        payload.set("title", files.length === 1 ? String(details.get("title") ?? "") : "");
        payload.set("file", body, isPhoto ? file.name.replace(/\.[^.]+$/, ".jpg") : file.name);

        const response = await postForm("/api/billboards/files", payload);
        if (response.ok === false || response.error) {
          throw new Error(`${file.name}: ${response.error ?? "the upload failed."}`);
        }
      }
      return {
        ok: true,
        message: files.length === 1 ? "Uploaded 1 file." : `Uploaded ${files.length} files.`,
      };
    });
    setProgress("");
    if (outcome) form.reset();
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <Field label="Category" htmlFor="uploadCategory" required>
        <Select
          id="uploadCategory"
          name="category"
          options={FILE_CATEGORIES.map((category) => ({ value: category, label: category }))}
        />
      </Field>
      <Field label="Date on the document" htmlFor="uploadDate" hint="Optional — for leases and letters.">
        <Input id="uploadDate" name="documentDate" type="date" />
      </Field>
      <Field
        label="Title"
        htmlFor="uploadTitle"
        hint="Optional. Used when uploading one file; otherwise each keeps its own name."
        className="sm:col-span-2"
      >
        <Input id="uploadTitle" name="title" placeholder="e.g. Front view after repainting" />
      </Field>
      <Field
        label="Photos or PDFs"
        htmlFor="uploadFiles"
        required
        hint="Choose several at once. Photos are shrunk before they are sent; PDFs up to 4 MB."
        className="sm:col-span-2"
      >
        <Input
          id="uploadFiles"
          name="files"
          type="file"
          multiple
          required
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
          className="cursor-pointer file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-brand-800"
        />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={busy !== null}>
          <UploadIcon className="size-4" />
          {busy ? progress || "Uploading…" : "Upload"}
        </Button>
        {result ? (
          <Alert tone={result.tone} className="mt-3">
            {result.text}
          </Alert>
        ) : null}
      </div>
    </form>
  );
}
