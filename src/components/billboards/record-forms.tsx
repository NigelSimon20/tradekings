"use client";

import {
  addCampaignAction,
  addMaintenanceAction,
  archiveBillboardAction,
  removeFileAction,
} from "@/app/(billboards)/billboards/actions";
import { ActionButton, FormResult, useRecordForm } from "@/components/forms/record-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { MAINTENANCE_KINDS, SITE_CONDITIONS } from "@/lib/billboards/types";

export function CampaignForm({ billboardId }: { billboardId: string }) {
  const { state, pending, form, onSubmit, error } = useRecordForm(addCampaignAction);
  return (
    <form ref={form} onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="billboardId" value={billboardId} />
      <Field label="Brand / product" htmlFor="brand" required error={error("brand")}>
        <Input id="brand" name="brand" placeholder="e.g. Boom" />
      </Field>
      <Field label="Campaign" htmlFor="campaign" error={error("campaign")}>
        <Input id="campaign" name="campaign" placeholder="e.g. Washing paste launch" />
      </Field>
      <Field label="Start date" htmlFor="startDate" required error={error("startDate")}>
        <Input id="startDate" name="startDate" type="date" />
      </Field>
      <Field label="End date" htmlFor="endDate" error={error("endDate")} hint="Leave blank if open-ended.">
        <Input id="endDate" name="endDate" type="date" />
      </Field>
      <Field label="Installed on" htmlFor="installedOn" error={error("installedOn")}>
        <Input id="installedOn" name="installedOn" type="date" />
      </Field>
      <Field label="Removed on" htmlFor="removedOn" error={error("removedOn")}>
        <Input id="removedOn" name="removedOn" type="date" />
      </Field>
      <Field
        label="Artwork link"
        htmlFor="artworkUrl"
        error={error("artworkUrl")}
        hint="A Google Drive or SharePoint link to the artwork."
        className="sm:col-span-2"
      >
        <Input id="artworkUrl" name="artworkUrl" type="url" placeholder="https://" />
      </Field>
      <Field label="Notes" htmlFor="campaignNotes" className="sm:col-span-2">
        <Textarea id="campaignNotes" name="notes" rows={2} />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Record campaign"}
        </Button>
        <FormResult state={state} />
      </div>
    </form>
  );
}

export function MaintenanceForm({ billboardId }: { billboardId: string }) {
  const { state, pending, form, onSubmit, error } = useRecordForm(addMaintenanceAction);
  return (
    <form ref={form} onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="billboardId" value={billboardId} />
      <Field label="Date" htmlFor="maintenanceDate" required error={error("date")}>
        <Input id="maintenanceDate" name="date" type="date" />
      </Field>
      <Field label="Type" htmlFor="kind" required error={error("kind")}>
        <Select
          id="kind"
          name="kind"
          defaultValue="Inspection"
          options={MAINTENANCE_KINDS.map((kind) => ({ value: kind, label: kind }))}
        />
      </Field>
      <Field
        label="Condition found"
        htmlFor="condition"
        error={error("condition")}
        hint="Updates the site's condition."
      >
        <Select
          id="condition"
          name="condition"
          placeholder="Not assessed"
          options={SITE_CONDITIONS.map((condition) => ({ value: condition, label: condition }))}
        />
      </Field>
      <Field
        label="Next inspection"
        htmlFor="nextInspectionDate"
        error={error("nextInspection")}
        hint="Updates the site's next inspection date."
      >
        <Input id="nextInspectionDate" name="nextInspection" type="date" />
      </Field>
      <Field
        label="What was found or done"
        htmlFor="description"
        required
        error={error("description")}
        className="sm:col-span-2"
      >
        <Textarea id="description" name="description" rows={3} />
      </Field>
      <Field label="Photo link" htmlFor="photoUrl" error={error("photoUrl")} className="sm:col-span-2">
        <Input id="photoUrl" name="photoUrl" type="url" placeholder="https://" />
      </Field>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Record maintenance"}
        </Button>
        <FormResult state={state} />
      </div>
    </form>
  );
}

export function RemoveFileButton({ fileId, title }: { fileId: string; title: string }) {
  return (
    <ActionButton
      action={removeFileAction}
      fields={{ fileId }}
      label="Remove"
      busyLabel="Removing…"
      look="link"
      confirm={`Remove “${title}” from this billboard? The record stays in the sheet.`}
    />
  );
}

export function ArchiveButton({ billboardId, archived }: { billboardId: string; archived: boolean }) {
  return (
    <ActionButton
      action={archiveBillboardAction}
      fields={{ billboardId, archive: archived ? "0" : "1" }}
      label={archived ? "Restore billboard" : "Archive billboard"}
      variant={archived ? "secondary" : "ghost"}
      showResult={false}
      confirm={
        archived ? undefined : "Archive this billboard? It leaves the map and dashboard, but its history is kept and it can be restored."
      }
    />
  );
}
