"use client";

import Image from "next/image";
import { useState } from "react";

import { RemoveFileButton } from "@/components/billboards/record-forms";
import { buttonClasses } from "@/components/ui/button";
import { ArrowLeftIcon, ChevronRightIcon, LinkIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { filePreviewUrl as previewUrl } from "@/lib/billboards/photos/files";
import { isSafeUrl } from "@/lib/billboards/schema";
import type { BillboardFile } from "@/lib/billboards/types";
import { formatDate } from "@/lib/date/dates";

/**
 * Uploaded photos as a grid of previews; clicking one opens it large, with the
 * way to the original in Drive.
 */
export function PhotoGallery({ photos, canRemove }: { photos: BillboardFile[]; canRemove: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const current = open === null ? null : photos[open];

  const step = (by: number) =>
    setOpen((index) => (index === null ? null : (index + by + photos.length) % photos.length));

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <button
              type="button"
              onClick={() => setOpen(index)}
              className="group block w-full cursor-pointer overflow-hidden rounded-xl text-left ring-1 ring-slate-200 transition hover:ring-brand-300"
            >
              <span className="relative block aspect-[4/3] bg-slate-100">
                <Image
                  src={previewUrl(photo)}
                  alt={photo.title}
                  fill
                  unoptimized
                  sizes="(min-width: 1024px) 25vw, 50vw"
                  className="object-cover transition group-hover:scale-[1.02]"
                />
              </span>
              <span className="block px-2.5 py-2">
                <span className="block truncate text-xs font-medium text-slate-900">{photo.title}</span>
                <span className="block truncate text-[11px] text-slate-500">
                  {photo.category} · {formatDate(photo.documentDate ?? photo.addedAt.slice(0, 10))}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {current ? (
        <Modal
          open
          size="lg"
          onClose={() => setOpen(null)}
          title={current.title}
          description={`${current.category} · added ${formatDate(current.addedAt.slice(0, 10))}${
            current.addedBy ? ` by ${current.addedBy}` : ""
          }`}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                <a href={previewUrl(current)} target="_blank" rel="noopener" className={buttonClasses("secondary", "sm")}>
                  Open full size
                </a>
                {isSafeUrl(current.url) ? (
                  <a
                    href={current.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClasses("secondary", "sm")}
                  >
                    <LinkIcon className="size-3.5" />
                    Open in Google Drive
                  </a>
                ) : null}
                {canRemove ? <RemoveFileButton fileId={current.id} title={current.title} /> : null}
              </div>
              {photos.length > 1 ? (
                <div className="flex gap-2">
                  <button type="button" onClick={() => step(-1)} className={buttonClasses("ghost", "sm")}>
                    <ArrowLeftIcon className="size-4" />
                    Previous
                  </button>
                  <button type="button" onClick={() => step(1)} className={buttonClasses("ghost", "sm")}>
                    Next
                    <ChevronRightIcon className="size-4" />
                  </button>
                </div>
              ) : null}
            </div>
          }
        >
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-900">
            <Image
              key={current.id}
              src={previewUrl(current)}
              alt={current.title}
              fill
              unoptimized
              sizes="(min-width: 768px) 48rem, 100vw"
              className="object-contain"
            />
          </div>
        </Modal>
      ) : null}
    </>
  );
}
