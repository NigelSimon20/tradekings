"use client";

import { useState } from "react";

import { saveAssetAction } from "@/app/(licenses)/licenses/actions";
import { Field, Select, Textarea } from "@/components/ui/field";
import {
  CoordinatesFields,
  FormError,
  FormFooter,
  FormSection,
  Suggestions,
  TextField,
  fieldsSoFar,
  textOf,
  type TextFieldProps,
} from "@/components/forms/form-parts";
import { useRecordForm } from "@/components/forms/record-form";
import { ASSET_TYPE_GROUPS, COMPANIES, LOCATION_ASSET_TYPES, type Asset } from "@/lib/licenses/types";

/**
 * Add or edit an asset — a warehouse, site, vehicle, piece of equipment or the
 * company itself. Places get a map pin (picked on the map, so nobody needs to
 * know the coordinates); vehicles get their registration or fleet number.
 */
export function AssetForm({
  defaults,
  mode,
  cities,
  departments,
}: {
  defaults: Partial<Asset>;
  mode: "create" | "edit";
  cities: string[];
  departments: string[];
}) {
  const { state, pending, onSubmit, form } = useRecordForm(saveAssetAction, {
    reset: false,
    openSaved: (saved) => (saved.recordId ? `/licenses/assets/${encodeURIComponent(saved.recordId)}` : null),
  });
  const [type, setType] = useState(defaults.type ?? "Warehouse");
  const isPlace = LOCATION_ASSET_TYPES.includes(type);
  const isVehicle = type === "Truck" || type === "Vehicle";

  /** Name, address and town as typed so far — the map picker's first search. */
  const placeSoFar = () => fieldsSoFar(form.current, ["name", "address", "city"]);

  const error = (field: string) => state.errors[field];
  const text = (key: keyof Asset) => textOf(defaults[key]);
  const input = (key: keyof Asset, label: string, extra: Partial<TextFieldProps> = {}) => (
    <TextField name={key} label={label} error={error} defaultValue={defaults[key]} {...extra} />
  );

  return (
    <form ref={form} onSubmit={onSubmit} className="space-y-5">
      <input type="hidden" name="existingId" value={mode === "edit" ? text("id") : ""} />
      <Suggestions id="asset-cities" values={cities} />
      <Suggestions id="asset-departments" values={departments} />

      <FormError state={state} title="The asset was not saved" />

      <FormSection title="The asset" description="What it is and who owns it.">
          {input("name", "Name", { required: true, wide: true, placeholder: "e.g. Msasa Warehouse, Truck 14 — Volvo FH" })}
          <Field label="Asset type" htmlFor="type" required error={error("type")}>
            <select
              id="type"
              name="type"
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="select-chevron w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 pr-9 text-sm text-slate-900 shadow-xs focus:border-brand-600 focus:ring-4 focus:ring-brand-600/12 focus:outline-none"
            >
              {Object.entries(ASSET_TYPE_GROUPS).map(([group, types]) => (
                <optgroup key={group} label={group}>
                  {types.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label="Company" htmlFor="company" error={error("company")}>
            <Select id="company" name="company" defaultValue={text("company") || "Trade Kings"} options={COMPANIES.map((value) => ({ value, label: value }))} />
          </Field>
          {input("department", "Department", { list: "asset-departments" })}
          {isVehicle || text("registration")
            ? input("registration", "Vehicle registration / fleet number", { placeholder: "e.g. AEZ 4471" })
            : input("registration", "Serial / reference number", { hint: "Optional." })}
          {mode === "create" ? input("id", "Asset ID", { hint: "Leave blank and the next number (AS-…) is used." }) : null}
      </FormSection>

      <FormSection title="Location" description={isPlace ? "Places appear on the license map." : "Where it is based. Vehicles and equipment are not shown on the map."}>
          {input("address", "Address / location", { wide: true })}
          {input("city", "City / town", { list: "asset-cities" })}
          <div />
          <CoordinatesFields error={error} defaults={defaults} suggestedSearch={placeSoFar} />
      </FormSection>

      <FormSection title="Responsibility">
          {input("responsibleName", "Responsible person")}
          {input("responsibleEmail", "Responsible email", { type: "email" })}
          <Field label="Notes" htmlFor="notes" error={error("notes")} className="sm:col-span-2">
            <Textarea id="notes" name="notes" rows={2} defaultValue={text("notes")} />
          </Field>
      </FormSection>

      <FormFooter pending={pending} submitLabel={mode === "create" ? "Add asset" : "Save changes"} cancelHref={mode === "edit" ? `/licenses/assets/${encodeURIComponent(text("id"))}` : "/licenses/assets"} />
    </form>
  );
}
