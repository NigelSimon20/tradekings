import { SharedFolderPicker } from "@/components/settings/shared-folder-picker";

/**
 * Below a connected Google account on Setup & access: file uploads into a
 * folder someone shared with that account, instead of the tracker's own folder.
 */
export function SharedFolderSection({
  app,
  account,
  pickerReady,
}: {
  app: "billboards" | "licenses" | "expats";
  account: { email: string; sharedFolder: { name: string; owner: string } | null };
  pickerReady: boolean;
}) {
  return (
    <section className="space-y-2 rounded-xl p-4 ring-1 ring-slate-200">
      <p className="font-medium text-slate-900">Store files in a folder shared with {account.email}</p>
      {pickerReady ? (
        <SharedFolderPicker app={app} email={account.email} current={account.sharedFolder} />
      ) : (
        <p className="text-slate-500">
          Needs one setting first: in the Google Cloud project, enable the Google Picker API and create an API key
          (restricted to the Picker API and this site&rsquo;s address), then set it as GOOGLE_PICKER_API_KEY and restart.
        </p>
      )}
    </section>
  );
}
