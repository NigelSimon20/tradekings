import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import {
  BillboardFlagBadges,
  BillboardStatusBadge,
  ConditionBadge,
  LeaseBadge,
} from "@/components/billboards/badges";
import { ExternalLink } from "@/components/billboards/external-link";
import { FileUpload } from "@/components/billboards/file-upload";
import { PhotoGallery } from "@/components/billboards/photo-gallery";
import {
  AddPanel,
  ArchiveButton,
  CampaignForm,
  FileForm,
  MaintenanceForm,
  RemoveFileButton,
} from "@/components/billboards/record-forms";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DefinitionList } from "@/components/ui/definition-list";
import { ArrowLeftIcon, BillboardIcon, ContractsIcon, PinIcon, SettingsIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@/components/ui/table";
import { canBillboards } from "@/lib/auth/roles";
import { getPhotoStore } from "@/lib/files";
import { cityFolderName, filePreviewUrl, siteFolderName } from "@/lib/files/files";
import { isSafeUrl } from "@/lib/billboards/schema";
import {
  PHOTO_CATEGORIES,
  FILE_CATEGORIES,
  type BillboardFile,
  type Campaign,
} from "@/lib/billboards/types";
import { getConfig } from "@/lib/config/env";
import { describeDays, formatDate, formatTimestamp } from "@/lib/date/dates";
import { requireBillboardViewer } from "@/lib/services/auth";
import { getBillboardProfile } from "@/lib/services/billboards";

export const dynamic = "force-dynamic";

const blank = (value: string | number | null | undefined): ReactNode =>
  value === null || value === undefined || value === "" ? <span className="text-slate-400">—</span> : value;

function Contact({
  role,
  name,
  phone,
  email,
}: {
  role: string;
  name: string;
  phone?: string;
  email: string;
}) {
  return (
    <div className="rounded-xl bg-slate-50/70 p-3 ring-1 ring-slate-200/70">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{role}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{name || <span className="text-slate-400">Not recorded</span>}</p>
      {phone ? (
        <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="block text-sm text-brand-700 hover:underline">
          {phone}
        </a>
      ) : null}
      {email ? (
        <a href={`mailto:${email}`} className="block truncate text-sm text-brand-700 hover:underline">
          {email}
        </a>
      ) : null}
    </div>
  );
}

function campaignLabel(campaign: Campaign): string {
  return `${campaign.brand}${campaign.campaign ? ` — ${campaign.campaign}` : ""}`;
}

export default async function BillboardProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireBillboardViewer("viewBillboards");
  const { id } = await params;
  const profile = await getBillboardProfile(decodeURIComponent(id));
  if (!profile) notFound();

  const { billboard, campaigns, maintenance, files, activity } = profile;
  const { computed } = billboard;
  const config = getConfig();
  const mayEdit = canBillboards(user, "editBillboards");
  const mayArchive = canBillboards(user, "archiveBillboards");
  const mayRemove = canBillboards(user, "removeDocuments");

  const isPhoto = (file: BillboardFile) => PHOTO_CATEGORIES.includes(file.category);
  // Uploaded photos get previews; everything else (PDFs, pasted links) is listed.
  const uploadedPhotos = files.filter(
    (file) => file.storedFileId && file.mimeType.startsWith("image/"),
  );
  const linkedFiles = files.filter((file) => !uploadedPhotos.includes(file));
  const uploadsOn = (await getPhotoStore("billboards")).kind !== "none";
  const mapLink =
    billboard.latitude !== null && billboard.longitude !== null
      ? `https://www.google.com/maps/search/?api=1&query=${billboard.latitude},${billboard.longitude}`
      : "";
  const current = computed.currentCampaign;

  return (
    <div className="space-y-6">
      <Link
        href="/billboards/list"
        className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeftIcon />
        All billboards
      </Link>

      <PageHeader
        eyebrow={`${billboard.id} · ${billboard.city}`}
        title={billboard.name}
        description={billboard.address || [billboard.road, billboard.area, billboard.city].filter(Boolean).join(", ")}
        actions={
          <>
            <ButtonLink href={`/billboards?focus=${encodeURIComponent(billboard.id)}`} variant="secondary">
              <PinIcon />
              Map
            </ButtonLink>
            {mayEdit ? (
              <ButtonLink href={`/billboards/${encodeURIComponent(billboard.id)}/edit`}>Edit billboard</ButtonLink>
            ) : null}
          </>
        }
      />

      {billboard.archived ? (
        <Alert tone="neutral" title="This billboard is archived">
          It is hidden from the map and dashboard. Everything recorded against it is kept below.
          {mayArchive ? (
            <div className="mt-3">
              <ArchiveButton billboardId={billboard.id} archived />
            </div>
          ) : null}
        </Alert>
      ) : null}

      {computed.flags.length ? (
        <Alert tone={computed.needsFollowUp ? "warning" : "info"} title="Needs attention">
          <div className="mt-2">
            <BillboardFlagBadges flags={computed.flags} />
          </div>
          {billboard.followUpNote ? <p className="mt-2">{billboard.followUpNote}</p> : null}
        </Alert>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader
            icon={<BillboardIcon className="size-4" />}
            title="Basic information"
            action={<BillboardStatusBadge status={billboard.status} />}
          />
          {computed.coverPhotoId ? (
            <div className="relative aspect-[16/7] bg-slate-100">
              <Image
                src={filePreviewUrl({ id: computed.coverPhotoId })}
                alt={`${billboard.name} — latest site photo`}
                fill
                unoptimized
                sizes="(min-width: 1280px) 40rem, 100vw"
                className="object-cover"
              />
            </div>
          ) : null}
          <CardBody>
            <DefinitionList
              columns={2}
              items={[
                { label: "Billboard ID", value: billboard.id },
                { label: "Type", value: blank(billboard.type) },
                { label: "City / town", value: blank(billboard.city) },
                { label: "Area", value: blank(billboard.area) },
                { label: "Road", value: blank(billboard.road) },
                { label: "Dimensions / faces", value: `${billboard.dimensions || "—"} · ${billboard.faces ?? "—"} face(s)` },
                {
                  label: "GPS coordinates",
                  value: mapLink ? (
                    <ExternalLink href={mapLink}>
                      {billboard.latitude}, {billboard.longitude}
                    </ExternalLink>
                  ) : (
                    <span className="text-slate-400">Not recorded</span>
                  ),
                },
                {
                  label: "Last updated",
                  value: `${formatTimestamp(billboard.lastUpdated, config.timezone)}${
                    billboard.lastUpdatedBy ? ` by ${billboard.lastUpdatedBy}` : ""
                  }`,
                },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={<ContractsIcon className="size-4" />}
            title="Lease"
            action={<LeaseBadge status={computed.leaseStatus} />}
          />
          <CardBody>
            <DefinitionList
              columns={2}
              items={[
                { label: "Owner", value: blank(billboard.owner) },
                { label: "Lease cost", value: blank(billboard.leaseCost) },
                { label: "Lease start", value: formatDate(billboard.leaseStart) },
                {
                  label: "Lease expiry",
                  value: billboard.leaseExpiry ? (
                    <span className="numeric">
                      {formatDate(billboard.leaseExpiry)} · {describeDays(computed.leaseDaysRemaining)}
                    </span>
                  ) : (
                    "—"
                  ),
                },
                {
                  label: "Notice period",
                  value: billboard.noticePeriodDays ? `${billboard.noticePeriodDays} days` : "—",
                },
                { label: "Last day to give notice", value: formatDate(computed.noticeDeadline) },
                { label: "Renewal / notice information", value: blank(billboard.renewalNotes) },
                { label: "Lease agreement", value: <ExternalLink href={billboard.leaseDocumentUrl}>Open the lease</ExternalLink> },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Contacts" />
        <CardBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Contact role="Landlord / property manager" name={billboard.landlordName} phone={billboard.landlordPhone} email={billboard.landlordEmail} />
          <Contact role="Council / local authority" name={billboard.councilName} phone={billboard.councilPhone} email={billboard.councilEmail} />
          <Contact role="Maintenance contractor" name={billboard.contractorName} phone={billboard.contractorPhone} email={billboard.contractorEmail} />
          <Contact role="Trade Kings responsible" name={billboard.responsibleName} email={billboard.responsibleEmail} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Current usage"
          description="What is on the board now, and every campaign recorded here."
          action={current ? <Badge tone="success">Live</Badge> : <Badge tone="neutral">Vacant</Badge>}
        />
        <CardBody className="space-y-4">
          {current ? (
            <DefinitionList
              columns={4}
              items={[
                { label: "Brand / campaign", value: campaignLabel(current) },
                { label: "Campaign dates", value: `${formatDate(current.startDate)} → ${formatDate(current.endDate)}` },
                { label: "Installed / removed", value: `${formatDate(current.installedOn)} / ${formatDate(current.removedOn)}` },
                { label: "Artwork", value: <ExternalLink href={current.artworkUrl}>Open artwork</ExternalLink> },
              ]}
            />
          ) : (
            <p className="text-sm text-slate-500">No campaign is running on this billboard today.</p>
          )}
          {computed.nextCampaign ? (
            <p className="text-sm text-slate-600">
              Next: <span className="font-medium">{campaignLabel(computed.nextCampaign)}</span> from{" "}
              {formatDate(computed.nextCampaign.startDate)}
            </p>
          ) : null}
          {mayEdit && !billboard.archived ? (
            <AddPanel label="Record a campaign">
              <CampaignForm billboardId={billboard.id} />
            </AddPanel>
          ) : null}
        </CardBody>
        {campaigns.length ? (
          <TableWrap className="border-t border-slate-100">
            <Table>
              <THead>
                <Tr className="hover:bg-transparent">
                  <Th>Campaign</Th>
                  <Th>Dates</Th>
                  <Th className="hidden md:table-cell">Installed / removed</Th>
                  <Th className="hidden md:table-cell">Artwork</Th>
                  <Th className="hidden lg:table-cell">Recorded</Th>
                </Tr>
              </THead>
              <TBody>
                {campaigns.map((campaign) => (
                  <Tr key={campaign.id}>
                    <Td className="font-medium text-slate-900">
                      {campaignLabel(campaign)}
                      {campaign.notes ? <p className="text-xs font-normal text-slate-500">{campaign.notes}</p> : null}
                    </Td>
                    <Td className="numeric">
                      {formatDate(campaign.startDate)} → {formatDate(campaign.endDate)}
                    </Td>
                    <Td className="numeric hidden md:table-cell">
                      {formatDate(campaign.installedOn)} / {formatDate(campaign.removedOn)}
                    </Td>
                    <Td className="hidden md:table-cell">
                      <ExternalLink href={campaign.artworkUrl} />
                    </Td>
                    <Td className="hidden text-xs text-slate-500 lg:table-cell">
                      {formatTimestamp(campaign.recordedAt, config.timezone)}
                      <br />
                      {campaign.recordedBy}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        ) : null}
      </Card>

      <Card>
        <CardHeader
          icon={<SettingsIcon className="size-4" />}
          title="Maintenance"
          description="The site as it is now, and every visit recorded."
          action={<ConditionBadge condition={billboard.siteCondition} />}
        />
        <CardBody className="space-y-4">
          <DefinitionList
            columns={4}
            items={[
              { label: "Site condition", value: <ConditionBadge condition={billboard.siteCondition} /> },
              { label: "Last inspection", value: formatDate(billboard.lastInspection) },
              {
                label: "Next inspection",
                value: (
                  <span className={computed.inspectionOverdue ? "font-medium" : undefined}>
                    {formatDate(billboard.nextInspection)}
                    {computed.inspectionOverdue ? " (overdue)" : ""}
                  </span>
                ),
              },
              { label: "Open issues", value: blank(billboard.maintenanceIssues) },
              { label: "Maintenance notes", value: blank(billboard.maintenanceNotes) },
            ]}
          />
          {mayEdit && !billboard.archived ? (
            <AddPanel label="Record a maintenance visit">
              <MaintenanceForm billboardId={billboard.id} />
            </AddPanel>
          ) : null}
        </CardBody>
        {maintenance.length ? (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {maintenance.map((record) => (
              <li key={record.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    {record.kind}
                    {record.condition ? (
                      <span className="ml-2">
                        <ConditionBadge condition={record.condition} />
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-slate-600">{record.description}</p>
                  {record.photoUrl ? <ExternalLink href={record.photoUrl}>Photo</ExternalLink> : null}
                </div>
                <p className="shrink-0 text-right text-xs text-slate-500">
                  {formatDate(record.date)}
                  <br />
                  {record.recordedBy}
                </p>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card>
        <CardHeader
          title="Photos & documents"
          description={
            uploadsOn
              ? `Uploads are filed in Google Drive under ${cityFolderName(billboard.city)} / ${siteFolderName(billboard)}. Removing one hides it here; the file and its record are kept.`
              : "Removing one hides it here; the record stays in the sheet."
          }
          action={<Badge tone="neutral">{files.length}</Badge>}
        />
        <CardBody className="space-y-5">
          <div>
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Photos</p>
            {uploadedPhotos.length ? (
              <div className="mt-2">
                <PhotoGallery photos={uploadedPhotos} canRemove={mayRemove} />
              </div>
            ) : null}
            {!uploadedPhotos.length && !linkedFiles.some(isPhoto) ? (
              <p className="mt-2 text-sm text-slate-400">No photos yet.</p>
            ) : null}
          </div>

          {linkedFiles.length ? (
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                {uploadedPhotos.length ? "Documents and linked files" : "Documents and links"}
              </p>
              <ul className="mt-2 divide-y divide-slate-100 rounded-xl ring-1 ring-slate-200/70">
                {[...linkedFiles]
                  .sort((a, b) => FILE_CATEGORIES.indexOf(a.category) - FILE_CATEGORIES.indexOf(b.category))
                  .map((file) => (
                    <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        {file.storedFileId ? (
                          <a
                            href={filePreviewUrl(file)}
                            target="_blank"
                            rel="noopener"
                            className="inline-flex items-center gap-1 font-medium break-all text-brand-700 hover:underline"
                          >
                            <ContractsIcon className="size-3.5 shrink-0" />
                            {file.title}
                          </a>
                        ) : (
                          <ExternalLink href={file.url}>{file.title}</ExternalLink>
                        )}
                        <p className="text-xs text-slate-500">
                          {file.category}
                          {file.documentDate ? ` · ${formatDate(file.documentDate)}` : ""} · added by{" "}
                          {file.addedBy || "—"}
                          {file.storedFileId && isSafeUrl(file.url) ? (
                            <>
                              {" · "}
                              <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-brand-700 hover:underline">
                                Drive
                              </a>
                            </>
                          ) : null}
                        </p>
                      </div>
                      {mayRemove ? <RemoveFileButton fileId={file.id} title={file.title} /> : null}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}

          {mayEdit && !billboard.archived ? (
            <div className="space-y-2">
              {uploadsOn ? (
                <AddPanel label="Upload photos or documents">
                  <FileUpload
                    endpoint="/api/billboards/files"
                    fields={{ billboardId: billboard.id }}
                    categories={FILE_CATEGORIES}
                  />
                </AddPanel>
              ) : (
                <p className="text-sm text-slate-500">
                  Uploading is not set up yet, so files are added as links. A billboard administrator can
                  connect a Google Shared drive from Setup &amp; access.
                </p>
              )}
              <AddPanel label={uploadsOn ? "Add a link instead" : "Add a photo or document link"}>
                <FileForm billboardId={billboard.id} />
              </AddPanel>
            </div>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Activity" description="Every change to this billboard: who, when and what." />
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
            <p className="px-5 py-6 text-sm text-slate-500">No changes recorded since this billboard was added.</p>
          )}
        </CardBody>
      </Card>

      {mayArchive && !billboard.archived ? (
        <div className="flex justify-end">
          <ArchiveButton billboardId={billboard.id} archived={false} />
        </div>
      ) : null}
    </div>
  );
}
