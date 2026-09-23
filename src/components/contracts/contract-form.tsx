"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { saveContractAction } from "@/app/(app)/contracts/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { RuleSummary } from "@/components/ui/rule-summary";
import { resolveRuleSetId, type RulesConfig } from "@/lib/config/rules";
import { EMPTY_FORM_STATE } from "@/lib/domain/form-state";
import {
  COMPANIES,
  CONTRACT_TYPES,
  RENEWAL_STATUSES,
  WORKER_TYPES,
  type Company,
  type Contract,
  type WorkerType,
} from "@/lib/domain/types";
import { checkTermAgainstRules, defaultEndDate } from "@/lib/rules/terms";

export interface ContractFormDefaults extends Partial<Contract> {
  id?: string;
}

/**
 * Create / edit form for a contract row.
 *
 * The end date follows the contract rules for the selected company and worker
 * type until HR types their own date, and the applicable rules are shown
 * alongside the form so the person capturing the contract can see them.
 */
export function ContractForm({
  defaults,
  mode,
  rules,
  submitLabel,
}: {
  defaults: ContractFormDefaults;
  mode: "create" | "edit";
  /** The rules in force, so the form matches what the system will calculate. */
  rules: RulesConfig;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveContractAction, EMPTY_FORM_STATE);

  const [company, setCompany] = useState<Company>(defaults.company ?? "Trade Kings");
  const [workerType, setWorkerType] = useState<WorkerType>(defaults.workerType ?? "Blue Collar");
  const [startDate, setStartDate] = useState(defaults.startDate ?? "");
  // `null` means "follow the contract rules"; typing a date pins it.
  const [endDateOverride, setEndDateOverride] = useState<string | null>(
    mode === "edit" ? (defaults.endDate ?? "") : null,
  );

  const ruleSet = rules.ruleSets[resolveRuleSetId(company, workerType)];
  const suggestedEnd = defaultEndDate(company, workerType, startDate, rules);
  const endDate = endDateOverride ?? suggestedEnd;
  // The rules are applied while the contract is being captured, not only after
  // it has been saved.
  const termWarning = checkTermAgainstRules(company, workerType, startDate, endDate, rules);

  useEffect(() => {
    if (state.status === "success" && mode === "create" && state.contractId) {
      router.push(`/contracts/${encodeURIComponent(state.contractId)}`);
    }
  }, [state, mode, router]);

  const error = (field: string) => state.errors[field];

  return (
    <form action={formAction} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <input type="hidden" name="id" value={defaults.id ?? ""} />

      <div className="space-y-5">
        {state.status === "error" ? (
          <Alert tone="critical" title="The contract was not saved">
            {state.message}
          </Alert>
        ) : null}
        {state.status === "success" && mode === "edit" ? (
          <Alert tone="success" title="Saved">
            {state.message}
          </Alert>
        ) : null}

        <Card>
          <CardHeader title="Employee" description="Who the contract belongs to." />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Employee ID" htmlFor="employeeId" required error={error("employeeId")}>
              <Input
                id="employeeId"
                name="employeeId"
                defaultValue={defaults.employeeId ?? ""}
                placeholder="TK-0101"
                required
              />
            </Field>
            <Field label="Employee name" htmlFor="employeeName" required error={error("employeeName")}>
              <Input
                id="employeeName"
                name="employeeName"
                defaultValue={defaults.employeeName ?? ""}
                required
              />
            </Field>
            <Field label="Employee email" htmlFor="employeeEmail" error={error("employeeEmail")}>
              <Input id="employeeEmail" name="employeeEmail" type="email" defaultValue={defaults.employeeEmail ?? ""} />
            </Field>
            <Field label="Job title" htmlFor="jobTitle" error={error("jobTitle")}>
              <Input id="jobTitle" name="jobTitle" defaultValue={defaults.jobTitle ?? ""} />
            </Field>
            <Field label="Company" htmlFor="company" required>
              <Select
                id="company"
                name="company"
                value={company}
                onChange={(event) => setCompany(event.target.value as Company)}
                options={COMPANIES.map((value) => ({ value, label: value }))}
              />
            </Field>
            <Field
              label="Worker type"
              htmlFor="workerType"
              hint="Chooses which contract rules apply."
            >
              <Select
                id="workerType"
                name="workerType"
                value={workerType}
                onChange={(event) => setWorkerType(event.target.value as WorkerType)}
                options={WORKER_TYPES.map((value) => ({ value, label: value }))}
              />
            </Field>
            <Field label="Department" htmlFor="department">
              <Input id="department" name="department" defaultValue={defaults.department ?? ""} />
            </Field>
            <Field label="Cost centre" htmlFor="costCentre">
              <Input id="costCentre" name="costCentre" defaultValue={defaults.costCentre ?? ""} />
            </Field>
            <Field label="Location / site" htmlFor="location">
              <Input id="location" name="location" defaultValue={defaults.location ?? ""} />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Contract" description="Dates drive every status and alert." />
          <CardBody className="space-y-4">
            {termWarning ? (
              <Alert tone="caution" title="Check these dates against the rules">
                {termWarning}
              </Alert>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contract type" htmlFor="contractType">
              <Select
                id="contractType"
                name="contractType"
                defaultValue={defaults.contractType ?? "New"}
                options={CONTRACT_TYPES.map((value) => ({ value, label: value }))}
              />
            </Field>
            <Field
              label="Contract number"
              htmlFor="contractNumber"
              hint="Leave blank to count automatically."
              error={error("contractNumber")}
            >
              <Input
                id="contractNumber"
                name="contractNumber"
                type="number"
                min={1}
                defaultValue={defaults.contractNumber ?? ""}
              />
            </Field>
            <Field label="Start date" htmlFor="startDate" required error={error("startDate")}>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                required
              />
            </Field>
            <Field
              label="End date"
              htmlFor="endDate"
              required
              error={error("endDate")}
              hint={
                suggestedEnd && endDate !== suggestedEnd
                  ? `The rules suggest ${suggestedEnd}.`
                  : "Set from the contract rules."
              }
            >
              <Input
                id="endDate"
                name="endDate"
                type="date"
                value={endDate}
                onChange={(event) => setEndDateOverride(event.target.value)}
                required
              />
            </Field>
            <Field
              label="Renewal status"
              htmlFor="renewalStatus"
              hint="A contract stays on the weekly report until this is decided."
            >
              <Select
                id="renewalStatus"
                name="renewalStatus"
                defaultValue={defaults.renewalStatus ?? "Pending"}
                options={RENEWAL_STATUSES.map((value) => ({ value, label: value }))}
              />
            </Field>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="People & notes" description="Who receives the weekly report for this employee." />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Direct manager" htmlFor="manager">
              <Input id="manager" name="manager" defaultValue={defaults.manager ?? ""} />
            </Field>
            <Field
              label="Manager email"
              htmlFor="managerEmail"
              hint="Used to filter the manager's weekly report."
              error={error("managerEmail")}
            >
              <Input id="managerEmail" name="managerEmail" type="email" defaultValue={defaults.managerEmail ?? ""} />
            </Field>
            <Field label="Responsible HR person" htmlFor="hrPerson">
              <Input id="hrPerson" name="hrPerson" defaultValue={defaults.hrPerson ?? ""} />
            </Field>
            <Field label="Responsible HR email" htmlFor="hrEmail" error={error("hrEmail")}>
              <Input id="hrEmail" name="hrEmail" type="email" defaultValue={defaults.hrEmail ?? ""} />
            </Field>
            <Field label="Notes / comments" htmlFor="notes" className="sm:col-span-2">
              <Textarea id="notes" name="notes" defaultValue={defaults.notes ?? ""} rows={3} />
            </Field>
          </CardBody>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : (submitLabel ?? (mode === "create" ? "Create contract" : "Save changes"))}
          </Button>
          <Link href="/contracts" className="text-sm text-slate-600 hover:text-slate-900">
            Cancel
          </Link>
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <Card>
          <CardHeader title="Rules being applied" description={ruleSet.label} />
          <CardBody>
            <RuleSummary ruleSet={ruleSet} />
          </CardBody>
        </Card>
      </aside>
    </form>
  );
}
