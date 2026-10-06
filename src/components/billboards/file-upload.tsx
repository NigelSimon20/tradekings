"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { UploadIcon } from "@/components/ui/icons";
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
export function FileUpload({
  endpoint,
  fields,
  categories,
  defaultCategory,
  extraFields,
  titlePlaceholder = "e.g. Front view after repainting",
  dateField = { name: "documentDate", label: "Date on the document", hint: "Optional — for leases and letters." },
}: {
  /** Where each file is posted, e.g. `/api/billboards/files`. */
  endpoint: string;
  /** Sent with every file — which record it belongs to. */
  fields: Record<string, string>;
  categories: readonly string[];
  defaultCategory?: string;
  /** More form controls, sent with every file (e.g. whose document it is). */
  extraFields?: ReactNode;
  titlePlaceholder?: string;
  /** The date asked for: the date on the document, or when it expires. */
  dateField?: { name: string; label: string; hint?: string };
}) {
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
        for (const [name, value] of Object.entries(fields)) payload.set(name, value);
        // Every control on the form — category, date and any extra fields.
        for (const [name, value] of details.entries()) {
          if (name !== "files" && typeof value === "string") payload.set(name, value);
        }
        // One title for several files would give them all the same name.
        payload.set("title", files.length === 1 ? String(details.get("title") ?? "") : "");
        payload.set("file", body, isPhoto ? file.name.replace(/\.[^.]+$/, ".jpg") : file.name);

        const response = await postForm(endpoint, payload);
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
      {extraFields}
      <Field label="Category" htmlFor="uploadCategory" required>
        <Select
          id="uploadCategory"
          name="category"
          defaultValue={defaultCategory}
          options={categories.map((category) => ({ value: category, label: category }))}
        />
      </Field>
      <Field label={dateField.label} htmlFor="uploadDate" hint={dateField.hint}>
        <Input id="uploadDate" name={dateField.name} type="date" />
      </Field>
      <Field
        label="Title"
        htmlFor="uploadTitle"
        hint="Optional. Used when uploading one file; otherwise each keeps its own name."
        className="sm:col-span-2"
      >
        <Input id="uploadTitle" name="title" placeholder={titlePlaceholder} />
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
