import { SetUpBillboardSheetButton } from "@/components/billboards/record-forms";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { SettingsIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { BILLBOARD_ROLES, describeBillboardRole } from "@/lib/auth/roles";
import { BILLBOARD_TABLES } from "@/lib/billboards/data/sheet-tables";
import { listSignInUsers, requireBillboardViewer } from "@/lib/services/auth";
import { checkBillboardSource } from "@/lib/services/billboards";

export const dynamic = "force-dynamic";

/** Where the billboard data lives and who can open it — for billboard administrators. */
export default async function BillboardSettingsPage() {
  await requireBillboardViewer("manageBillboards");
  const [health, users] = await Promise.all([checkBillboardSource(), listSignInUsers()]);
  const withAccess = users.filter((user) => user.billboards.trim());

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Billboard tracker"
        title="Setup & access"
        description="The billboard spreadsheet and who can use the billboard tracker."
      />

      <Card>
        <CardHeader
          icon={<SettingsIcon className="size-4" />}
          title="Billboard spreadsheet"
          description={health.detail}
          action={<Badge tone={health.ok ? "success" : "warning"}>{health.label}</Badge>}
        />
        <CardBody className="space-y-4">
          {health.warnings.map((warning) => (
            <Alert key={warning} tone="caution">
              {warning}
            </Alert>
          ))}

          {health.kind === "google-sheets" ? (
            <>
              <p className="text-sm text-slate-600">
                Creates any missing tab ({BILLBOARD_TABLES.map((table) => table.tab).join(", ")}), adds
                missing headings, dropdowns and date formats. Safe to press again — it never changes a
                value someone has typed.
              </p>
              <SetUpBillboardSheetButton />
            </>
          ) : (
            <div className="space-y-2 text-sm text-slate-600">
              <p>
                The tracker is showing sample data. To connect the real billboard spreadsheet, your
                system administrator needs to:
              </p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>Create an empty Google spreadsheet for the billboards.</li>
                <li>Share it with the tracker&rsquo;s service account as an Editor (the same one the contract sheet uses).</li>
                <li>Put its ID in the GOOGLE_BILLBOARDS_SHEET_ID setting and restart the app.</li>
                <li>Come back here and press &ldquo;Prepare the billboard sheet&rdquo;.</li>
              </ol>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Who can use the billboard tracker"
          description="Set in the Billboards column of the Users tab in the users spreadsheet. Blank means no access to billboards."
          action={<Badge tone="info">{withAccess.length} people</Badge>}
        />
        {withAccess.length ? (
          <TableWrap>
            <Table>
              <THead>
                <Tr className="hover:bg-transparent">
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Billboards</Th>
                  <Th className="hidden md:table-cell">Contracts</Th>
                  <Th>Can sign in</Th>
                </Tr>
              </THead>
              <TBody>
                {withAccess.map((person) => (
                  <Tr key={person.email}>
                    <Td className="font-medium text-slate-900">{person.name}</Td>
                    <Td>{person.email}</Td>
                    <Td>
                      {person.parsedBillboardRole ? (
                        <Badge tone="neutral" title={describeBillboardRole(person.parsedBillboardRole)}>
                          {person.parsedBillboardRole}
                        </Badge>
                      ) : (
                        <Badge tone="critical" title="Should be Administrator, Editor or Viewer">
                          {person.billboards}
                        </Badge>
                      )}
                    </Td>
                    <Td className="hidden text-slate-500 md:table-cell">{person.parsedRole ?? "—"}</Td>
                    <Td>
                      <Badge tone={person.active ? "success" : "neutral"}>{person.active ? "Yes" : "No"}</Badge>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        ) : (
          <CardBody>
            <p className="text-sm text-slate-500">
              Nobody has billboard access on the Users tab yet. The addresses in ADMIN_EMAILS can always
              sign in as administrators.
            </p>
          </CardBody>
        )}
        <CardBody className="border-t border-slate-100">
          <dl className="grid gap-3 sm:grid-cols-3">
            {BILLBOARD_ROLES.map((role) => (
              <div key={role}>
                <dt className="text-sm font-medium text-slate-900">{role}</dt>
                <dd className="text-sm text-slate-500">{describeBillboardRole(role)}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}
