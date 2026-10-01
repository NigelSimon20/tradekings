import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { AddPanel } from "@/components/billboards/record-forms";
import { LicenseFlagBadges, LicenseStatusBadge } from "@/components/licenses/badges";
import { DocumentList } from "@/components/licenses/document-list";
import { ArchiveButton, RenewalForm } from "@/components/licenses/license-controls";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DefinitionList } from "@/components/ui/definition-list";
import { ArrowLeftIcon, BuildingIcon, ShieldCheckIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { canLicenses } from "@/lib/auth/roles";
import { getConfig } from "@/lib/config/env";
import { addMonths, describeDays, formatDate, formatTimestamp } from "@/lib/date/dates";
import { getPhotoStore } from "@/lib/files";
import { FREQUENCY_MONTHS } from "@/lib/licenses/types";
import { requireLicenseViewer } from "@/lib/services/auth";
import { getLicenseProfile } from "@/lib/services/licenses";

export const dynamic = "force-dynamic";

const blank = (value: string | null | undefined): ReactNode =>
  value ? value : <span className="text-slate-400">—</span>;

export default async function LicensePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireLicenseViewer("viewLicenses");
  const { id } = await params;
  const profile = await getLicenseProfile(decodeURIComponent(id));
  if (!profile) notFound();

  const { license, renewals, documents, activity } = profile;
  const { computed } = license;
  const asset = computed.asset;
  const config = getConfig();
  const mayEdit = canLicenses(user, "editLicenses");
  const mayRemove = canLicenses(user, "removeLicenseDocuments");
  const uploadsOn = (await getPhotoStore("licenses")).kind !== "none";
  const months = FREQUENCY_MONTHS[license.renewalFrequency] ?? null;
  const suggestedExpiry = license.expiryDate && months ? addMonths(license.expiryDate, months) : null;
  const flags = computed.flags.filter((flag) => flag.code !== "RENEWAL_PENDING");

  return (
    <div className="space-y-6">
      <Link href="/licenses/register" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeftIcon />
        License register
      </Link>

      <PageHeader
        eyebrow={`${license.id} · ${license.category}`}
        title={license.name}
        description={[license.type, license.number, license.issuingAuthority].filter(Boolean).join(" · ")}
        actions={
          mayEdit ? <ButtonLink href={`/licenses/${encodeURIComponent(license.id)}/edit`}>Edit license</ButtonLink> : null
        }
      />

      {license.archived ? (
        <Alert tone="neutral" title="This license is archived">
          It is off the register and dashboard. Everything recorded against it is kept below.
          {mayEdit ? (
            <div className="mt-3">
              <ArchiveButton kind="license" recordId={license.id} archived />
            </div>
          ) : null}
        </Alert>
      ) : null}

      {flags.length ? (
        <Alert tone={computed.needsAction ? "warning" : "info"} title={computed.needsAction ? "Needs action" : "Worth checking"}>
          <div className="mt-2">
            <LicenseFlagBadges flags={flags} />
          </div>
        </Alert>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            icon={<ShieldCheckIcon className="size-4" />}
            title="License"
            action={<LicenseStatusBadge status={computed.status} reminderDays={computed.reminderDays} />}
          />
          <CardBody>
            <DefinitionList
              columns={3}
              items={[
                { label: "License / certificate number", value: blank(license.number) },
                { label: "License type", value: license.type },
                { label: "Category", value: license.category },
                { label: "Issuing authority", value: blank(license.issuingAuthority) },
                { label: "Issue date", value: formatDate(license.issueDate) },
                {
                  label: "Expiry date",
                  value: (
                    <span className="numeric">
                      {formatDate(license.expiryDate)}
                      {computed.daysRemaining !== null ? ` · ${describeDays(computed.daysRemaining)}` : ""}
                    </span>
                  ),
                },
                { label: "Renewal frequency", value: license.renewalFrequency },
                { label: "Renewal status", value: license.renewalStatus },
                { label: "Next renewal", value: formatDate(computed.nextRenewalDate) },
                { label: "Last renewal", value: formatDate(license.lastRenewalDate) },
                { label: "Notes or conditions", value: blank(license.conditions) },
                {
                  label: "Last updated",
                  value: `${formatTimestamp(license.lastUpdated, config.timezone)}${license.lastUpdatedBy ? ` by ${license.lastUpdatedBy}` : ""}`,
                },
              ]}
            />
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader icon={<BuildingIcon className="size-4" />} title="Belongs to" />
            <CardBody>
              {asset ? (
                <div className="space-y-1">
                  <Link href={`/licenses/assets/${encodeURIComponent(asset.id)}`} className="font-medium text-brand-700 hover:underline">
                    {asset.name}
                  </Link>
                  <p className="text-sm text-slate-600">
                    {[asset.type, asset.registration, asset.city].filter(Boolean).join(" · ")}
                  </p>
                  <Link
                    href={`/licenses/register?asset=${encodeURIComponent(asset.id)}`}
                    className="text-xs font-medium text-brand-700 hover:underline"
                  >
                    All licenses for this {asset.type.toLowerCase()}
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-slate-600">A company-wide license, not tied to one asset.</p>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Responsibility and contacts" />
            <CardBody>
              <DefinitionList
                columns={2}
                items={[
                  { label: "Department", value: blank(license.department) },
                  {
                    label: "Responsible person",
                    value: license.responsibleEmail ? (
                      <a href={`mailto:${license.responsibleEmail}`} className="text-brand-700 hover:underline">
                        {license.responsibleName || license.responsibleEmail}
                      </a>
                    ) : (
                      blank(license.responsibleName)
                    ),
                  },
                  { label: "Contact", value: blank(license.contactName) },
                  {
                    label: "Phone / email",
                    value: (
                      <>
                        {license.contactPhone ? (
                          <a href={`tel:${license.contactPhone.replace(/[^\d+]/g, "")}`} className="block text-brand-700 hover:underline">
                            {license.contactPhone}
                          </a>
                        ) : null}
                        {license.contactEmail ? (
                          <a href={`mailto:${license.contactEmail}`} className="block truncate text-brand-700 hover:underline">
                            {license.contactEmail}
                          </a>
                        ) : null}
                        {!license.contactPhone && !license.contactEmail ? <span className="text-slate-400">—</span> : null}
                      </>
                    ),
                  },
                ]}
              />
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Renewals"
          description="Each renewal keeps the dates it replaced, and the renewed certificate when one was uploaded."
        />
        <CardBody className="space-y-4">
          {mayEdit && !license.archived ? (
            <AddPanel label="Record a renewal">
              <RenewalForm licenseId={license.id} currentExpiry={license.expiryDate} suggestedExpiry={suggestedExpiry} />
            </AddPanel>
          ) : null}
          {!renewals.length ? <p className="text-sm text-slate-400">No renewals recorded yet.</p> : null}
        </CardBody>
        {renewals.length ? (
          <TableWrap className="border-t border-slate-100">
            <Table>
              <THead>
                <Tr className="hover:bg-transparent">
                  <Th>Renewed on</Th>
                  <Th>Previous expiry</Th>
                  <Th>New dates</Th>
                  <Th className="hidden md:table-cell">Certificate</Th>
                  <Th className="hidden lg:table-cell">Recorded</Th>
                </Tr>
              </THead>
              <TBody>
                {renewals.map((renewal) => (
                  <Tr key={renewal.id}>
                    <Td className="numeric">{formatDate(renewal.renewedOn)}</Td>
                    <Td className="numeric">{formatDate(renewal.previousExpiry)}</Td>
                    <Td className="numeric">
                      {formatDate(renewal.newIssueDate)} → {formatDate(renewal.newExpiry)}
                      {renewal.notes ? <p className="text-xs text-slate-500">{renewal.notes}</p> : null}
                    </Td>
                    <Td className="hidden md:table-cell">
                      {renewal.newNumber || "—"}
                      {renewal.documentId && documents.some((document) => document.id === renewal.documentId) ? (
                        <a
                          href={`/api/licenses/files/${encodeURIComponent(renewal.documentId)}`}
                          target="_blank"
                          rel="noopener"
                          className="ml-2 text-xs font-medium text-brand-700 hover:underline"
                        >
                          Open
                        </a>
                      ) : null}
                    </Td>
                    <Td className="hidden text-xs text-slate-500 lg:table-cell">
                      {formatTimestamp(renewal.recordedAt, config.timezone)}
                      <br />
                      {renewal.recordedBy}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        ) : null}
      </Card>

      <DocumentList
        documents={documents}
        target={{ licenseId: license.id, assetId: license.assetId }}
        mayAdd={mayEdit && !license.archived}
        mayRemove={mayRemove}
        uploadsOn={uploadsOn}
      />

      <Card>
        <CardHeader title="Activity" description="Every change to this license: who, when and what." />
        <CardBody className="p-0">
          {activity.length ? (
            <ul className="divide-y divide-slate-100">
              {activity.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{entry.action}</p>
                    {entry.details ? <p className="text-xs break-words text-slate-500">{entry.details}</p> : null}
                  </div>
                  <p className="shrink-0 text-xs text-slate-500">
                    {formatTimestamp(entry.at, config.timezone)} · {entry.by || "—"}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-slate-500">No changes recorded since this license was added.</p>
          )}
        </CardBody>
      </Card>

      {mayEdit && !license.archived ? (
        <div className="flex justify-end">
          <ArchiveButton kind="license" recordId={license.id} archived={false} />
        </div>
      ) : null}
    </div>
  );
}
