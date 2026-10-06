"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";

import { saveUserAccessAction } from "@/app/(app)/settings/user-actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { PlusIcon } from "@/components/ui/icons";
import type { UserAdminRights } from "@/lib/auth/user-admin";
import { EMPTY_USER_ACCESS_STATE } from "@/lib/domain/form-state";
import { TONE_CLASSES } from "@/lib/ui/tones";
import { cn } from "@/lib/ui/cn";

export interface EditableUser {
  email: string;
  name: string;
  /** Contracts column: the role's name, or what was typed if it is not a role. */
  role: string;
  roleKnown: boolean;
  billboards: string;
  billboardsKnown: boolean;
  licenses: string;
  licensesKnown: boolean;
  expats: string;
  expatsKnown: boolean;
  active: boolean;
  lastSignedIn: string;
}

const GRID =
  "grid gap-2 px-5 py-3 md:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))_5.5rem_minmax(0,0.8fr)_5rem] md:items-center";

/**
 * Who can sign in, and to what — editable by administrators. Each app's
 * administrators change that app's column; switching someone off (Active)
 * needs both. What is shown is only a convenience: the server applies the
 * same rules to every save.
 */
export function UsersEditor({
  users,
  contractRoles,
  billboardRoles,
  licenseRoles,
  expatRoles,
  rights,
  currentEmail,
}: {
  users: EditableUser[];
  contractRoles: string[];
  billboardRoles: string[];
  licenseRoles: string[];
  expatRoles: string[];
  rights: UserAdminRights;
  currentEmail: string;
}) {
  const canEdit = rights.contracts || rights.billboards || rights.licenses || rights.expats;

  return (
    <div>
      <div className={cn(GRID, "hidden border-b border-slate-100 bg-slate-50/70 py-2.5 md:grid")}>
        {["Person", "Contract Tracker", "Billboard Tracker", "License Tracker", "Expat Tracker", "Active", "Last signed in", ""].map((heading) => (
          <p key={heading || "save"} className="text-[11px] font-semibold tracking-[0.06em] text-slate-500 uppercase">
            {heading}
          </p>
        ))}
      </div>

      <ul className="divide-y divide-slate-100">
        {users.map((user) => (
          <UserRow
            key={user.email}
            user={user}
            contractRoles={contractRoles}
            billboardRoles={billboardRoles}
            licenseRoles={licenseRoles}
            expatRoles={expatRoles}
            rights={rights}
            isSelf={user.email === currentEmail.trim().toLowerCase()}
          />
        ))}
      </ul>

      {canEdit ? (
        <AddPerson
          contractRoles={contractRoles}
          billboardRoles={billboardRoles}
          licenseRoles={licenseRoles}
          expatRoles={expatRoles}
          rights={rights}
        />
      ) : null}
    </div>
  );
}

function RoleText({ value, known }: { value: string; known: boolean }) {
  if (!value) return <span className="text-slate-400">No access</span>;
  if (!known) {
    return (
      <span className={TONE_CLASSES.critical.text} title="Not a role on the roles tab — this person cannot use this app">
        {value} (not a role)
      </span>
    );
  }
  return <span className={value === "Not allowed" ? "text-slate-400" : "text-slate-800"}>{value}</span>;
}

/** Controlled when `onChange` is given (rows); left to the form otherwise (adding), so a reset clears it. */
function RoleSelect({
  name,
  label,
  value,
  roles,
  onChange,
  id,
}: {
  name: string;
  label: string;
  value: string;
  roles: string[];
  onChange?: (value: string) => void;
  id?: string;
}) {
  // A value that is not a role stays visible so it can be corrected.
  const options = [
    { value: "", label: "No access" },
    ...roles.map((role) => ({ value: role, label: role })),
    ...(value && !roles.includes(value) ? [{ value, label: `${value} (not a role)` }] : []),
  ];
  return (
    <Select
      id={id}
      name={name}
      aria-label={label}
      {...(onChange ? { value, onChange: (event) => onChange(event.target.value) } : { defaultValue: value })}
      options={options}
      className="py-1.5"
    />
  );
}

function UserRow({
  user,
  contractRoles,
  billboardRoles,
  licenseRoles,
  expatRoles,
  rights,
  isSelf,
}: {
  user: EditableUser;
  contractRoles: string[];
  billboardRoles: string[];
  licenseRoles: string[];
  expatRoles: string[];
  rights: UserAdminRights;
  isSelf: boolean;
}) {
  const [state, dispatch, pending] = useActionState(saveUserAccessAction, EMPTY_USER_ACCESS_STATE);
  const [role, setRole] = useState(user.role);
  const [billboards, setBillboards] = useState(user.billboards);
  const [licenses, setLicenses] = useState(user.licenses);
  const [expats, setExpats] = useState(user.expats);
  const [active, setActive] = useState(user.active);

  const editContracts = rights.contracts && !isSelf;
  const editBillboards = rights.billboards && !isSelf;
  const editLicenses = rights.licenses && !isSelf;
  const editExpats = rights.expats && !isSelf;
  const editActive = rights.active && !isSelf;
  const dirty =
    role !== user.role ||
    billboards !== user.billboards ||
    licenses !== user.licenses ||
    expats !== user.expats ||
    active !== user.active;

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  };

  return (
    <li>
      <form onSubmit={onSubmit} className={GRID}>
        <input type="hidden" name="email" value={user.email} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">
            {user.name && user.name !== user.email ? user.name : user.email}
            {isSelf ? <span className="ml-2 text-xs font-normal text-slate-500">(you)</span> : null}
          </p>
          {user.name && user.name !== user.email ? (
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          ) : null}
        </div>

        <div className="text-sm">
          <span className="text-xs text-slate-500 md:hidden">Contract Tracker: </span>
          {editContracts ? (
            <RoleSelect name="role" label={`Contract Tracker role for ${user.email}`} value={role} roles={contractRoles} onChange={setRole} />
          ) : (
            <RoleText value={user.role} known={user.roleKnown} />
          )}
        </div>

        <div className="text-sm">
          <span className="text-xs text-slate-500 md:hidden">Billboard Tracker: </span>
          {editBillboards ? (
            <RoleSelect
              name="billboards"
              label={`Billboard Tracker role for ${user.email}`}
              value={billboards}
              roles={billboardRoles}
              onChange={setBillboards}
            />
          ) : (
            <RoleText value={user.billboards} known={user.billboardsKnown} />
          )}
        </div>

        <div className="text-sm">
          <span className="text-xs text-slate-500 md:hidden">License Tracker: </span>
          {editLicenses ? (
            <RoleSelect
              name="licenses"
              label={`License Tracker role for ${user.email}`}
              value={licenses}
              roles={licenseRoles}
              onChange={setLicenses}
            />
          ) : (
            <RoleText value={user.licenses} known={user.licensesKnown} />
          )}
        </div>

        <div className="text-sm">
          <span className="text-xs text-slate-500 md:hidden">Expat Tracker: </span>
          {editExpats ? (
            <RoleSelect
              name="expats"
              label={`Expat Tracker role for ${user.email}`}
              value={expats}
              roles={expatRoles}
              onChange={setExpats}
            />
          ) : (
            <RoleText value={user.expats} known={user.expatsKnown} />
          )}
        </div>

        <div className="text-sm">
          {editActive ? (
            <Select
              name="active"
              aria-label={`Active for ${user.email}`}
              value={active ? "yes" : "no"}
              onChange={(event) => setActive(event.target.value === "yes")}
              options={[
                { value: "yes", label: "Yes" },
                { value: "no", label: "No" },
              ]}
              className="py-1.5"
            />
          ) : (
            <span className={user.active ? "text-slate-800" : "text-slate-400"}>
              <span className="text-xs text-slate-500 md:hidden">Active: </span>
              {user.active ? "Yes" : "No"}
            </span>
          )}
        </div>

        <p className="text-xs text-slate-500">
          <span className="md:hidden">Last signed in: </span>
          {user.lastSignedIn ? user.lastSignedIn.replace("T", " ").slice(0, 16) : "never"}
        </p>

        <div className="md:text-right">
          {dirty ? (
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          ) : null}
        </div>

        {state.status !== "idle" && !(state.status === "success" && dirty) ? (
          <p
            className={cn(
              "text-xs md:col-span-8",
              state.status === "error" ? TONE_CLASSES.critical.text : TONE_CLASSES.success.text,
            )}
          >
            {state.message}
          </p>
        ) : null}
      </form>
    </li>
  );
}

function AddPerson({
  contractRoles,
  billboardRoles,
  licenseRoles,
  expatRoles,
  rights,
}: {
  contractRoles: string[];
  billboardRoles: string[];
  licenseRoles: string[];
  expatRoles: string[];
  rights: UserAdminRights;
}) {
  const [state, dispatch, pending] = useActionState(saveUserAccessAction, EMPTY_USER_ACCESS_STATE);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") form.current?.reset();
  }, [state]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => dispatch(data));
  };

  return (
    <form ref={form} onSubmit={onSubmit} className="space-y-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4">
      <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
        <PlusIcon className="size-4" />
        Add a person
      </p>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Field label="Google email" htmlFor="new-email" required>
          <Input id="new-email" name="email" type="email" placeholder="name@tkzim.co.zw" required />
        </Field>
        <Field label="Name" htmlFor="new-name">
          <Input id="new-name" name="name" />
        </Field>
        {rights.contracts ? (
          <Field label="Contract Tracker" htmlFor="new-role">
            <RoleSelect id="new-role" name="role" label="Contract Tracker role" value="" roles={contractRoles} />
          </Field>
        ) : null}
        {rights.billboards ? (
          <Field label="Billboard Tracker" htmlFor="new-billboards">
            <RoleSelect id="new-billboards" name="billboards" label="Billboard Tracker role" value="" roles={billboardRoles} />
          </Field>
        ) : null}
        {rights.licenses ? (
          <Field label="License Tracker" htmlFor="new-licenses">
            <RoleSelect id="new-licenses" name="licenses" label="License Tracker role" value="" roles={licenseRoles} />
          </Field>
        ) : null}
        {rights.expats ? (
          <Field label="Expat Tracker" htmlFor="new-expats">
            <RoleSelect id="new-expats" name="expats" label="Expat Tracker role" value="" roles={expatRoles} />
          </Field>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Adding…" : "Add person"}
        </Button>
        {state.status !== "idle" ? (
          <Alert tone={state.status === "success" ? "success" : "critical"} className="py-2">
            {state.message}
          </Alert>
        ) : null}
      </div>
    </form>
  );
}
