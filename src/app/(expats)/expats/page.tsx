import Link from "next/link";

import { ExpiryTable } from "@/components/expats/expiry-table";
import { Pipeline } from "@/components/expats/pipeline";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { AlertIcon, CalendarIcon, ClipboardIcon, PassportIcon, PlusIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { canExpats } from "@/lib/auth/roles";
import { getConfig } from "@/lib/config/env";
import { describeDays, formatDate, formatTimestamp } from "@/lib/date/dates";
import type { Tone } from "@/lib/domain/meta";
import type { PageSearchParams } from "@/lib/domain/filters";
import { profileHref } from "@/lib/expats/meta";
import { OPEN_ACTION, type ProfileSection } from "@/lib/expats/types";
import { EXPAT_TILES, EXPIRY_VIEWS, findView } from "@/lib/expats/views";
import { requireExpatViewer } from "@/lib/services/auth";
import { loadExpats } from "@/lib/services/expats";
import { TONE_CLASSES } from "@/lib/ui/tones";
import { cn } from "@/lib/ui/cn";

export const dynamic = "force-dynamic";

interface Urgent {
  key: string;
  expatId: string;
  person: string;
  title: string;
  detail: string;
  tone: Tone;
  section: ProfileSection;
  /** Lower is more urgent. */
  rank: number;
}

/** The Expat Tracker's front door: the overview, what needs action now, and what is coming. */
export default async function ExpatDashboardPage({ searchParams }: PageSearchParams) {
  const user = await requireExpatViewer("viewExpats");
  const denied = (await searchParams).denied === "1";
  const config = getConfig();
  const snapshot = await loadExpats(user);
  const { people, expiries, actions, applications, rules, today, source, activity } = snapshot;
  const names = new Map(people.map((row) => [row.expat.id, row.expat.fullName]));
  const input = { people, expiries, actions, applications, today };

  // "An Action Required section should highlight urgent items."
  const urgent: Urgent[] = [
    ...expiries
      .filter((item) => item.needsAction)
      .map((item) => ({
        key: item.key,
        expatId: item.expatId,
        person: item.dependantId ? `${item.personName} (${item.expatName})` : item.expatName,
        title: item.status === "EXPIRED" ? `${item.kind} expired` : `${item.kind} due for renewal`,
        detail: `${formatDate(item.expiryDate)} · ${describeDays(item.daysRemaining)}`,
        tone: (item.status === "EXPIRED" ? "critical" : "warning") as Tone,
        section: item.section,
        rank: item.daysRemaining,
      })),
    ...actions
      .filter((action) => OPEN_ACTION.includes(action.status) && action.dueDate && action.dueDate < today)
      .map((action) => ({
        key: action.id,
        expatId: action.expatId,
        person: names.get(action.expatId) ?? action.expatId,
        title: `Follow-up overdue: ${action.title}`,
        detail: `Due ${formatDate(action.dueDate)}${action.responsibleName ? ` · ${action.responsibleName}` : ""}`,
        tone: "danger" as Tone,
        section: "actions" as ProfileSection,
        rank: -1000,
      })),
    ...applications
      .filter((permit) => permit.outstanding.length)
      .map((permit) => ({
        key: permit.id,
        expatId: permit.expatId,
        person: permit.personName,
        title: `${permit.type} application waiting for documents`,
        detail: permit.outstanding.join(", "),
        tone: "caution" as Tone,
        section: (permit.dependantId ? "household" : "immigration") as ProfileSection,
        rank: 1000,
      })),
  ].sort((a, b) => a.rank - b.rank);

  const upcoming = expiries.filter((item) => findView(EXPIRY_VIEWS, "upcoming")!.matches(item, today));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Trade Kings · ZimKings"
        title="Expats & dependants"
        description={`Profiles, permits, homes and vehicles as at ${formatDate(today)}. Reminders at ${rules.reminderDays.join(", ")} days before expiry.`}
        actions={
          <>
            <ButtonLink href="/expats/expiries" variant="secondary">
              <CalendarIcon className="size-4" />
              Master expiry view
            </ButtonLink>
            {canExpats(user, "editExpats") ? (
              <ButtonLink href="/expats/new" className="lg:hidden">
                <PlusIcon />
                Add expat
              </ButtonLink>
            ) : null}
          </>
        }
      />

      {denied ? (
        <Alert tone="warning" title="That page is not available to your account">
          You were brought back here because your Expat Tracker access does not include what you opened.
        </Alert>
      ) : null}
      {source.kind === "local" ? (
        <Alert tone="caution" title="You are looking at practice data" icon={<AlertIcon className="size-4" />}>
          The expat spreadsheet is not connected yet, so the tracker is showing a sample register.
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {EXPAT_TILES.map((tile) => (
          <StatCard
            key={tile.id}
            label={tile.label}
            value={tile.count(input)}
            description={tile.description(input)}
            tone={tile.tone}
            href={tile.href}
          />
        ))}
      </div>

      <Card>
        <CardHeader
          icon={<AlertIcon className="size-4" />}
          title="Action required"
          description="Expired or due with no renewal started, overdue follow-ups, and applications waiting for documents."
          action={
            <ButtonLink href="/expats/expiries?view=action" variant="secondary" size="sm">
              All dates needing action
            </ButtonLink>
          }
        />
        {urgent.length ? (
          <ul className="divide-y divide-slate-100">
            {urgent.slice(0, 12).map((item) => (
              <li key={item.key}>
                <Link
                  href={profileHref(item.expatId, item.section)}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3 hover:bg-slate-50"
                >
                  <span className="flex min-w-0 items-start gap-3">
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", TONE_CLASSES[item.tone].dot)} aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900">{item.title}</span>
                      <span className="block text-xs break-words text-slate-500">{item.detail}</span>
                    </span>
                  </span>
                  <span className="text-sm text-brand-700">{item.person}</span>
                </Link>
              </li>
            ))}
            {urgent.length > 12 ? (
              <li className="px-5 py-3 text-xs text-slate-500">
                And {urgent.length - 12} more —{" "}
                <Link href="/expats/people?view=action" className="font-medium text-brand-700 hover:underline">
                  see every profile needing action
                </Link>
                .
              </li>
            ) : null}
          </ul>
        ) : (
          <EmptyState icon={<AlertIcon className="size-5" />} title="Nothing needs action" description="Everything is in date, or its renewal is under way." />
        )}
      </Card>

      <div className="grid gap-5 2xl:grid-cols-2">
        <Card>
          <CardHeader
            icon={<CalendarIcon className="size-4" />}
            title="Coming up"
            description="Everything that expires in the next 90 days, soonest first."
            action={
              <ButtonLink href="/expats/expiries?view=upcoming" variant="secondary" size="sm">
                View all {upcoming.length}
              </ButtonLink>
            }
          />
          <ExpiryTable
            items={[...upcoming].sort((a, b) => a.daysRemaining - b.daysRemaining).slice(0, 8)}
            restricted={snapshot.restricted}
            emptyTitle="Nothing expires in the next 90 days"
            emptyDescription="Nothing to renew for now."
          />
        </Card>
        <Card>
          <CardHeader
            icon={<PassportIcon className="size-4" />}
            title="Applications & renewals in progress"
            description="Documents Required → Ready for Submission → Submitted → In Progress → Approved → Issued."
            action={
              <ButtonLink href="/expats/applications" variant="secondary" size="sm">
                View all {applications.length}
              </ButtonLink>
            }
          />
          {applications.length ? (
            <ul className="divide-y divide-slate-100">
              {applications.slice(0, 8).map((permit) => (
                <li key={permit.id}>
                  <Link
                    href={profileHref(permit.expatId, permit.dependantId ? "household" : "immigration")}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900">
                        {permit.type}
                        {permit.replacesId ? " renewal" : ""}
                      </span>
                      <span className="block text-xs text-slate-500">{permit.personName}</span>
                    </span>
                    <Pipeline status={permit.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<PassportIcon className="size-5" />} title="No applications in progress" description="Nothing is with the authorities." />
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          icon={<ClipboardIcon className="size-4" />}
          title="Recent changes"
          description="Who changed what, and when. Every change is kept in the Activity Log tab."
        />
        <CardBody className="p-0">
          {activity.length ? (
            <ul className="divide-y divide-slate-100">
              {activity.slice(0, 8).map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-900">
                      <span className="font-medium">
                        {entry.action}
                        {["Expat", "Document", "System"].includes(entry.recordType) ? "" : ` (${entry.recordType.toLowerCase()})`}
                      </span>{" "}
                      {entry.expatId ? (
                        <Link href={profileHref(entry.expatId)} className="text-brand-700 hover:underline">
                          {names.get(entry.expatId) ?? entry.expatId}
                        </Link>
                      ) : null}
                    </p>
                    {entry.details ? <p className="line-clamp-2 text-xs text-slate-500">{entry.details}</p> : null}
                  </div>
                  <p className="shrink-0 text-xs text-slate-500">
                    {formatTimestamp(entry.at, config.timezone)} · {entry.by || "—"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-slate-500">No changes recorded yet.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
