"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { CONTRACT_STATUSES, COMPANIES, CONTRACT_TYPES, WORKER_TYPES, FLAG_CODES } from "@/lib/domain/types";
import { DAYS_BUCKETS, toSearchParams, type ContractFilters } from "@/lib/domain/filters";
import { FLAG_META, STATUS_META } from "@/lib/domain/meta";
import type { FilterOptions } from "@/lib/domain/filters";

/**
 * Filter bar for the contracts list. Filters live in the URL, so any view can
 * be bookmarked, shared with HR, or linked to from a dashboard tile.
 */
export function ContractFiltersBar({
  filters,
  options,
  resultCount,
}: {
  filters: ContractFilters;
  options: FilterOptions;
  resultCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(filters.q);

  const navigate = (next: Partial<ContractFilters>) => {
    const params = toSearchParams({ ...filters, ...next, page: 1 });
    startTransition(() => router.push(`/contracts?${params.toString()}`));
  };

  const activeCount = countActive(filters);

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/70">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          navigate({ q: search });
        }}
      >
        <div className="min-w-56 flex-1">
          <label htmlFor="contract-search" className="block text-xs font-medium text-slate-600">
            Search
          </label>
          <Input
            id="contract-search"
            value={search}
            placeholder="Name, employee ID, job title, notes…"
            onChange={(event) => setSearch(event.target.value)}
            onBlur={() => search !== filters.q && navigate({ q: search })}
            className="mt-1"
          />
        </div>

        <FilterSelect
          label="Company"
          value={filters.company}
          placeholder="All companies"
          options={COMPANIES.map((company) => ({ value: company, label: company }))}
          onChange={(company) => navigate({ company })}
        />
        <FilterSelect
          label="Employment type"
          value={filters.workerType}
          placeholder="All types"
          options={WORKER_TYPES.map((type) => ({ value: type, label: type }))}
          onChange={(workerType) => navigate({ workerType })}
        />
        <FilterSelect
          label="Department"
          value={filters.department}
          placeholder="All departments"
          options={options.departments.map((value) => ({ value, label: value }))}
          onChange={(department) => navigate({ department })}
        />
        <FilterSelect
          label="Cost centre"
          value={filters.costCentre}
          placeholder="All cost centres"
          options={options.costCentres.map((value) => ({ value, label: value }))}
          onChange={(costCentre) => navigate({ costCentre })}
        />
        <FilterSelect
          label="Manager"
          value={filters.manager}
          placeholder="All managers"
          options={options.managers.map((manager) => ({ value: manager.email, label: manager.name }))}
          onChange={(manager) => navigate({ manager })}
        />
        <FilterSelect
          label="Contract type"
          value={filters.contractType}
          placeholder="All contract types"
          options={CONTRACT_TYPES.map((type) => ({ value: type, label: type }))}
          onChange={(contractType) => navigate({ contractType })}
        />
        <FilterSelect
          label="Contract status"
          value={filters.status}
          placeholder="All statuses"
          options={CONTRACT_STATUSES.map((status) => ({
            value: status,
            label: STATUS_META[status].label,
          }))}
          onChange={(status) => navigate({ status })}
        />
        <FilterSelect
          label="Days remaining"
          value={filters.days}
          placeholder="Any"
          options={DAYS_BUCKETS.map((bucket) => ({ value: bucket.value, label: bucket.label }))}
          onChange={(days) => navigate({ days })}
        />
        <FilterSelect
          label="Flag"
          value={filters.flag}
          placeholder="All flags"
          options={FLAG_CODES.map((code) => ({ value: code, label: FLAG_META[code].label }))}
          onChange={(flag) => navigate({ flag })}
        />
        <FilterSelect
          label="Location"
          value={filters.location}
          placeholder="All locations"
          options={options.locations.map((value) => ({ value, label: value }))}
          onChange={(location) => navigate({ location })}
        />
      </form>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={filters.history}
            onChange={(event) => navigate({ history: event.target.checked })}
            className="size-4 rounded border-slate-300 text-brand-700 focus:ring-brand-600"
          />
          Include renewed contract history
        </label>

        <div className="flex items-center gap-3">
          <p className="text-xs text-slate-500">
            {pending ? "Updating…" : `${resultCount} contract${resultCount === 1 ? "" : "s"}`}
          </p>
          {activeCount > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                startTransition(() => router.push("/contracts"));
              }}
            >
              Clear {activeCount} filter{activeCount === 1 ? "" : "s"}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const id = `filter-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="min-w-40">
      <label htmlFor={id} className="block text-xs font-medium text-slate-600">
        {label}
      </label>
      <Select
        id={id}
        value={value}
        placeholder={placeholder}
        options={options}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1"
      />
    </div>
  );
}

function countActive(filters: ContractFilters): number {
  const keys: (keyof ContractFilters)[] = [
    "view",
    "q",
    "company",
    "workerType",
    "department",
    "costCentre",
    "manager",
    "contractType",
    "status",
    "days",
    "flag",
    "location",
    "history",
  ];
  return keys.filter((key) => Boolean(filters[key])).length;
}
