"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { saveAssetAction } from "@/app/(licenses)/licenses/actions";
import { LocationPicker } from "@/components/billboards/location-picker";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EMPTY_LICENSE_FORM_STATE } from "@/lib/licenses/form-state";
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
  const router = useRouter();
  const [state, dispatch, pending] = useActionState(saveAssetAction, EMPTY_LICENSE_FORM_STATE);
  const form = useRef<HTMLFormElement>(null);
  const [type, setType] = useState(defaults.type ?? "Warehouse");
  const [latitude, setLatitude] = useState(defaults.latitude?.toString() ?? "");
  const [longitude, setLongitude] = useState(defaults.longitude?.toString() ?? "");
  const isPlace = LOCATION_ASSET_TYPES.includes(type);
  const isVehicle = type === "Truck" || type === "Vehicle";
  const pinned =
    latitude.trim() && longitude.trim() && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
      ? { latitude: Number(latitude), longitude: Number(longitude) }
      : null;

  useEffect(() => {
    if (state.status === "success" && state.recordId) {
      router.push(`/licenses/assets/${encodeURIComponent(state.recordId)}`);
    }
  }, [state, router]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  };

  const placeSoFar = () => {
    const field = (name: string) =>
      String((form.current?.elements.namedItem(name) as HTMLInputElement | null)?.value ?? "").trim();
    return [field("name"), field("address"), field("city")].filter(Boolean).join(", ");
  };

  const error = (field: string) => state.errors[field];
  const text = (key: keyof Asset) => {
    const value = defaults[key];
    return value === null || value === undefined ? "" : String(value);
  };
  const input = (key: keyof Asset, label: string, extra: { required?: boolean; hint?: ReactNode; placeholder?: string; wide?: boolean; list?: string; type?: string } = {}) => (
    <Field label={label} htmlFor={key} required={extra.required} error={error(key)} hint={extra.hint} className={extra.wide ? "sm:col-span-2" : undefined}>
      <Input id={key} name={key} type={extra.type ?? "text"} defaultValue={text(key)} placeholder={extra.placeholder} list={extra.list} />
    </Field>
  );

  return (
    <form ref={form} onSubmit={onSubmit} className="space-y-5">
      <input type="hidden" name="existingId" value={mode === "edit" ? text("id") : ""} />
      <datalist id="asset-cities">
        {cities.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>
      <datalist id="asset-departments">
        {departments.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>

      {state.status === "error" ? (
        <Alert tone="critical" title="The asset was not saved">
          {state.message}
        </Alert>
      ) : null}

      <Card>
        <CardHeader title="The asset" description="What it is and who owns it." />
        <CardBody className="grid gap-4 sm:grid-cols-2">
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
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Location"
          description={isPlace ? "Places appear on the license map." : "Where it is based. Vehicles and equipment are not shown on the map."}
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          {input("address", "Address / location", { wide: true })}
          {input("city", "City / town", { list: "asset-cities" })}
          <div />
          <Field label="Latitude" htmlFor="latitude" error={error("latitude")}>
            <Input id="latitude" name="latitude" type="number" step="any" value={latitude} onChange={(event) => setLatitude(event.target.value)} />
          </Field>
          <Field label="Longitude" htmlFor="longitude" error={error("longitude")}>
            <Input id="longitude" name="longitude" type="number" step="any" value={longitude} onChange={(event) => setLongitude(event.target.value)} />
          </Field>
          <LocationPicker
            value={pinned}
            suggestedSearch={placeSoFar}
            onPick={(point) => {
              setLatitude(String(point.latitude));
              setLongitude(String(point.longitude));
            }}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Responsibility" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          {input("responsibleName", "Responsible person")}
          {input("responsibleEmail", "Responsible email", { type: "email" })}
          <Field label="Notes" htmlFor="notes" error={error("notes")} className="sm:col-span-2">
            <Textarea id="notes" name="notes" rows={2} defaultValue={text("notes")} />
          </Field>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Add asset" : "Save changes"}
        </Button>
        <Link
          href={mode === "edit" ? `/licenses/assets/${encodeURIComponent(text("id"))}` : "/licenses/assets"}
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
