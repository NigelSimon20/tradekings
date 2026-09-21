"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DownloadIcon, UploadIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import type { ImportSummary } from "@/lib/services/import";
import { cn } from "@/lib/ui/cn";

type Step = "choose" | "review" | "done";

/**
 * Bulk import for the contracts table.
 *
 * Nothing is written until the person has seen what the file contains: the
 * first request only validates and reports, the second writes the new rows.
 */
export function ImportDialog() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("choose");
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [, startTransition] = useTransition();

  const reset = () => {
    setStep("choose");
    setFile(null);
    setSummary(null);
    setError("");
    setIncludeDuplicates(false);
  };

  const close = () => {
    setOpen(false);
    // Let the closing animation finish before the contents change.
    window.setTimeout(reset, 150);
  };

  const send = async (mode: "preview" | "commit", chosen: File) => {
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("file", chosen);
      body.set("mode", mode);
      body.set("includeDuplicates", String(includeDuplicates));

      const response = await fetch("/api/import", { method: "POST", body });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        summary?: ImportSummary;
      };
      if (!response.ok || payload.ok === false || !payload.summary) {
        throw new Error(payload.error ?? "The file could not be read.");
      }

      setSummary(payload.summary);
      setStep(mode === "commit" ? "done" : "review");
      if (mode === "commit") startTransition(() => router.refresh());
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const choose = (chosen: File | undefined) => {
    if (!chosen) return;
    setFile(chosen);
    void send("preview", chosen);
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <UploadIcon className="size-4" />
        Import
      </Button>

      <Modal
        open={open}
        onClose={close}
        size="lg"
        title="Import contracts"
        description="Upload a CSV export of the contract database. Columns are matched by their headings."
        footer={
          step === "review" && summary ? (
            <>
              <Button variant="ghost" onClick={() => reset()} disabled={busy}>
                Choose another file
              </Button>
              <Button
                onClick={() => file && void send("commit", file)}
                disabled={busy || summary.newRows + (includeDuplicates ? summary.duplicates : 0) === 0}
              >
                {busy
                  ? "Importing…"
                  : `Import ${summary.newRows + (includeDuplicates ? summary.duplicates : 0)} contracts`}
              </Button>
            </>
          ) : (
            <Button variant="secondary" onClick={close}>
              {step === "done" ? "Done" : "Cancel"}
            </Button>
          )
        }
      >
        {error ? (
          <Alert tone="critical" title="That did not work" className="mb-4">
            {error}
          </Alert>
        ) : null}

        {step === "choose" ? (
          <div className="space-y-4">
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                choose(event.dataTransfer.files[0]);
              }}
              className={cn(
                "flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition",
                dragging ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-slate-50/60",
              )}
            >
              <span className="inline-flex size-11 items-center justify-center rounded-xl bg-brand-700 text-white">
                <UploadIcon className="size-5" />
              </span>
              <p className="mt-3 text-sm font-medium text-slate-800">
                Drop a CSV file here, or choose one
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Up to 2 MB. Nothing is written until you have reviewed what the file contains.
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => choose(event.target.files?.[0])}
              />
              <Button
                variant="secondary"
                size="sm"
                className="mt-4"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
              >
                {busy ? "Reading…" : "Choose file"}
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <p className="text-slate-500">
                Not sure about the format? Start from the template.
              </p>
              <a
                href="/api/import"
                className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:underline"
              >
                <DownloadIcon className="size-4" />
                Download template
              </a>
            </div>
          </div>
        ) : null}

        {step === "review" && summary ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Tally label="New" value={summary.newRows} tone="text-emerald-700" />
              <Tally label="Already captured" value={summary.duplicates} tone="text-slate-600" />
              <Tally label="Cannot import" value={summary.invalid} tone="text-red-700" />
            </div>

            {summary.missingColumns.length ? (
              <Alert tone="critical" title="Required columns are missing">
                {summary.missingColumns.join(", ")}. Add them to the file and try again.
              </Alert>
            ) : null}

            {summary.unknownHeaders.length ? (
              <Alert tone="caution" title="Columns that will be ignored">
                {summary.unknownHeaders.join(", ")}
              </Alert>
            ) : null}

            <SampleList
              title="Will be imported"
              rows={summary.samples.new.map((row) => ({ ...row, reason: "" }))}
              total={summary.newRows}
            />
            <SampleList
              title="Already in the database"
              rows={summary.samples.duplicates}
              total={summary.duplicates}
            />
            <SampleList title="Cannot be read" rows={summary.samples.invalid} total={summary.invalid} />

            {summary.duplicates > 0 ? (
              <label className="flex items-start gap-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={includeDuplicates}
                  onChange={(event) => setIncludeDuplicates(event.target.checked)}
                  className="mt-0.5 size-4 rounded border-slate-300 text-brand-700 focus:ring-brand-600"
                />
                <span>
                  Import the {summary.duplicates} row{summary.duplicates === 1 ? "" : "s"} that already
                  exist as well. This creates a second contract row for the same employee and start
                  date.
                </span>
              </label>
            ) : null}
          </div>
        ) : null}

        {step === "done" && summary ? (
          <Alert tone="success" title={`${summary.imported ?? 0} contracts imported`}>
            The contract rules have been applied to the new rows — they now appear on the dashboard and
            in the weekly reports.
            {summary.invalid > 0
              ? ` ${summary.invalid} row${summary.invalid === 1 ? "" : "s"} could not be read and ${summary.invalid === 1 ? "was" : "were"} left out.`
              : ""}
          </Alert>
        ) : null}
      </Modal>
    </>
  );
}

function Tally({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3 text-center ring-1 ring-slate-200/70">
      <p className={cn("numeric font-display text-2xl font-semibold", value === 0 ? "text-slate-300" : tone)}>
        {value}
      </p>
      <p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}

function SampleList({
  title,
  rows,
  total,
}: {
  title: string;
  rows: { line: number; label: string; reason: string }[];
  total: number;
}) {
  if (!total) return null;

  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        {title} ({total})
      </p>
      <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-xl ring-1 ring-slate-200/70">
        {rows.map((row) => (
          <li key={`${title}-${row.line}`} className="flex items-baseline gap-3 px-3 py-2 text-sm">
            <span className="numeric w-12 shrink-0 text-xs text-slate-400">Row {row.line}</span>
            <span className="min-w-0 flex-1 truncate text-slate-800">{row.label}</span>
            {row.reason ? (
              <span className="shrink-0 text-xs text-slate-500">{row.reason}</span>
            ) : null}
          </li>
        ))}
        {total > rows.length ? (
          <li className="px-3 py-2 text-xs text-slate-500">…and {total - rows.length} more</li>
        ) : null}
      </ul>
    </div>
  );
}
