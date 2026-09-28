import { SetupSheetButton } from "@/components/settings/setup-sheet-button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DefinitionList } from "@/components/ui/definition-list";
import { ContractsIcon, ReportsIcon, SettingsIcon } from "@/components/ui/icons";
import { PERMISSION_INFO } from "@/lib/auth/roles";
import { RoleMatrix } from "@/components/ui/role-matrix";
import { PageHeader } from "@/components/ui/page-header";
import { RuleSummary } from "@/components/ui/rule-summary";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";

import { COLUMN_TYPE_LABELS } from "@/lib/domain/meta";
import { formatUtcHourInZone } from "@/lib/date/dates";
import { getConfig } from "@/lib/config/env";
import { duplicateEnvKeys } from "@/lib/config/env-file";
import { CONTRACT_COLUMNS } from "@/lib/data/sheet-schema";
import { getMailer } from "@/lib/email/mailer";
import { can } from "@/lib/auth/roles";
import { getRoleTable, requireViewer } from "@/lib/services/auth";
import { loadUsersEditor } from "@/lib/services/users";
import { UsersEditor } from "@/components/settings/users-editor";
import { checkDataSource } from "@/lib/services/contracts";
import { getReportSettings, getRulesConfig } from "@/lib/services/settings";

export const dynamic = "force-dynamic";

/** Read-only view of the rules and the wiring behind the automation. */
export default async function SettingsPage() {
  const viewer = await requireViewer("viewAll");
  const config = getConfig();
  const health = await checkDataSource();
  const settings = await getReportSettings();
  const { rules, fromSheet: rulesFromSheet } = await getRulesConfig();
  const [people, roleTable] = await Promise.all([loadUsersEditor(), getRoleTable()]);
  const duplicateSettings = duplicateEnvKeys();
  const mailer = getMailer();

  // Marks the values an administrator has overridden on the sheet's Settings tab.
  const source = (key: string) => (settings.fromSheet.includes(key) ? " (from the sheet)" : "");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Configuration"
        title="Rules & settings"
        description="The contract rules the system applies, and how the automation is wired up."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {Object.values(rules.ruleSets).map((ruleSet) => (
          <Card key={ruleSet.id}>
            <CardHeader
              title={ruleSet.label}
              action={
                <Badge tone={ruleSet.maxContracts ? "warning" : "success"}>
                  {ruleSet.maxContracts ? `Max ${ruleSet.maxContracts}` : "Unlimited"}
                </Badge>
              }
            />
            <CardBody>
              <RuleSummary ruleSet={ruleSet} />
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader
          icon={<ReportsIcon className="size-4" />}
          title="Alert thresholds"
          description="Applied to every contract, regardless of company."
          action={
            rulesFromSheet.length ? (
              <Badge tone="info">{rulesFromSheet.length} changed on the sheet</Badge>
            ) : null
          }
        />
        <CardBody>
          <DefinitionList
            columns={4}
            items={[
              { label: "First alert", value: `${rules.alertDays.first} days before expiry` },
              { label: "Second alert", value: `${rules.alertDays.second} days before expiry` },
              { label: "Expired", value: "On the day the contract ends" },
              { label: "Overdue", value: `${rules.overdueAfterDays} days after expiry with no update` },
            ]}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          icon={<SettingsIcon className="size-4" />}
          title="How the tracker is set up"
          description="Where the contract information lives, and how the weekly emails go out."
          action={
            <Badge tone={health.ok ? "success" : "critical"}>
              {health.ok ? "Working" : "Needs attention"}
            </Badge>
          }
        />
        <CardBody className="space-y-4">
          <DefinitionList
            columns={3}
            items={[
              {
                label: "Contract database",
                value:
                  config.dataSource === "google-sheets"
                    ? `Google Sheet — ${health.detail}`
                    : `Practice data — ${health.detail}`,
              },
              { label: "Weekly emails", value: mailer.label },
              {
                label: "HR report goes to",
                value: `${settings.hrRecipient || "Not set yet — add it on the Settings tab of the Google Sheet"}${source("hrRecipient")}`,
              },
              {
                label: "Copied on the HR report",
                value: `${settings.reportCc.join(", ") || "Nobody"}${source("reportCc")}`,
              },
              {
                label: "Manager reports",
                value: `${
                  settings.managerReportsEnabled
                    ? settings.skipEmptyManagerReports
                      ? "On — a manager is only emailed when something needs their attention"
                      : "On — every manager is emailed each week"
                    : "Off"
                }${source("managerReportsEnabled") || source("skipEmptyManagerReports")}`,
              },
              {
                label: "Weekly report runs",
                value: `Mondays at ${formatUtcHourInZone(6, config.timezone)}`,
              },
              {
                label: "Daily contract check",
                value: `Every day at ${formatUtcHourInZone(3, config.timezone)}`,
              },
              { label: "Time zone", value: config.timezone },
              {
                label: "Signing in",
                value: config.auth.enabled
                  ? "A password is required to open the tracker"
                  : "No password set — anyone with the link can open the tracker",
              },
              {
                label: "Scheduled runs",
                value: config.cronSecret
                  ? "Protected with a shared key"
                  : "Not protected — they will refuse to start once deployed",
              },
            ]}
          />

          {duplicateSettings.length ? (
            <Alert tone="critical" title="Some settings are listed twice">
              {duplicateSettings.join(", ")} appear more than once in the settings file, and only the
              last one counts — so a value you have set may be quietly ignored. Remove the repeats.
            </Alert>
          ) : null}

          {health.warnings.map((warning) => (
            <Alert key={warning} tone="caution">
              {warning}
            </Alert>
          ))}

          {can(viewer, "manageSystem") ? (
            <SetupSheetButton connected={config.dataSource === "google-sheets"} />
          ) : null}

          <Alert tone="info" title="Changing the rules and the recipients">
            Every number above — the contract lengths, the limits, the waiting period and the alert
            days — can be changed on the <strong>Settings</strong> tab of the Google Sheet. Leave a
            row blank to keep the standard rule.
          </Alert>

          <Alert tone="info" title="Changing who receives the reports">
            The HR address and the manager settings live on the <strong>Settings</strong> tab of the
            Google Sheet, so they can be changed there at any time. Which employees appear in each
            manager&rsquo;s report always comes from the <strong>Manager Email</strong> column.
          </Alert>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          icon={<SettingsIcon className="size-4" />}
          title="Contract Tracker roles"
          description="What each role may do. Change the ticks — or add a row for a new role — on the Contract Roles tab of the users spreadsheet; changes apply within about 30 seconds."
        />
        <RoleMatrix roles={roleTable.contracts} catalogue={PERMISSION_INFO} />
      </Card>

      <Card>
        <CardHeader
          icon={<SettingsIcon className="size-4" />}
          title="Who can sign in"
          description={
            people.rights.contracts || people.rights.billboards
              ? "Change someone's access to each app, or add a person. Saved to the Users tab of the users spreadsheet; applies within about 30 seconds."
              : "Set on the Users tab of the users spreadsheet. Only administrators can change it."
          }
        />
        {people.editable ? (
          <UsersEditor
            users={people.users}
            contractRoles={people.contractRoles}
            billboardRoles={people.billboardRoles}
            rights={people.rights}
            currentEmail={people.currentEmail}
          />
        ) : (
          <CardBody>
            <p className="text-sm text-slate-500">
              The tracker is running on sample data, so there is no Users tab yet. Once the Google Sheet is
              connected, people can be added and given access here.
            </p>
          </CardBody>
        )}
      </Card>

      <Card>
        <CardHeader
          icon={<ContractsIcon className="size-4" />}
          title="What goes in the Google Sheet"
          description="Columns are matched by their headings, so they can be moved around in the sheet. The ones marked “System” are filled in for you and are overwritten on every check."
        />
        <TableWrap>
          <Table>
            <THead>
              <Tr className="hover:bg-transparent">
                <Th>Column</Th>
                <Th>Filled in by</Th>
                <Th>Type</Th>
                <Th>Notes</Th>
              </Tr>
            </THead>
            <TBody>
              {CONTRACT_COLUMNS.map((column) => (
                <Tr key={column.key}>
                  <Td className="font-medium text-slate-900">{column.header}</Td>
                  <Td>
                    <Badge tone={column.kind === "calculated" ? "info" : "neutral"}>
                      {column.kind === "calculated" ? "Filled in by the system" : "Filled in by HR"}
                    </Badge>
                  </Td>
                  <Td className="hidden sm:table-cell">{COLUMN_TYPE_LABELS[column.type]}</Td>
                  <Td className="hidden text-slate-500 md:table-cell">
                    {column.note ?? (column.options ? column.options.join(" · ") : "—")}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      </Card>

      <Card>
        <CardHeader
          icon={<ReportsIcon className="size-4" />}
          title="Who does what"
          description="Responsibilities agreed in the specification."
        />
        <CardBody>
          <DefinitionList
            columns={3}
            items={[
              {
                label: "HR / Admin",
                value:
                  "Maintain employee and contract information, update renewals, review the weekly report, run manual checks.",
              },
              {
                label: "Managers",
                value:
                  "Receive the filtered weekly report, review contracts needing attention, act on upcoming renewals and expiries.",
              },
              {
                label: "System administrator",
                value:
                  "Maintain the automation, manage recipients and permissions, keep the sheet integration and rules up to date.",
              },
            ]}
          />
        </CardBody>
      </Card>
    </div>
  );
}
