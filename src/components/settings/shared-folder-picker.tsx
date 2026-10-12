"use client";

import { useState, type FormEvent } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { folderIdFromLink } from "@/lib/files/folder-link";
import { postJson, useApiAction } from "@/lib/ui/use-api-action";

/** The little of Google's picker library this uses. */
interface PickerView {
  setIncludeFolders(value: boolean): PickerView;
  setSelectFolderEnabled(value: boolean): PickerView;
  setMimeTypes(value: string): PickerView;
  setOwnedByMe?(value: boolean): PickerView;
  setEnableDrives?(value: boolean): PickerView;
  setFileIds?(value: string): PickerView;
  setLabel?(value: string): PickerView;
}
interface PickerBuilder {
  addView(view: PickerView): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setAppId(id: string): PickerBuilder;
  setTitle(title: string): PickerBuilder;
  setCallback(callback: (data: { action: string; docs?: { id: string; name: string }[] }) => void): PickerBuilder;
  build(): { setVisible(visible: boolean): void };
}
interface PickerLibrary {
  DocsView: new (viewId?: string) => PickerView;
  ViewId: { FOLDERS: string };
  PickerBuilder: new () => PickerBuilder;
  Action: { PICKED: string; CANCEL: string };
}
type PickerWindow = Window & {
  gapi?: { load(name: string, options: { callback: () => void; onerror?: () => void }): void };
  google?: { picker?: PickerLibrary };
};

const FOLDER = "application/vnd.google-apps.folder";

let loading: Promise<PickerLibrary> | null = null;

/** Loads Google's picker once per page. */
function loadPicker(): Promise<PickerLibrary> {
  const w = window as PickerWindow;
  if (w.google?.picker) return Promise.resolve(w.google.picker);
  loading ??= new Promise<PickerLibrary>((resolve, reject) => {
    const failed = () => {
      loading = null;
      reject(new Error("Google's folder picker could not be loaded. Check the connection and try again."));
    };
    const ready = () => w.gapi!.load("picker", { callback: () => resolve(w.google!.picker!), onerror: failed });
    if (w.gapi) return ready();
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.onload = ready;
    script.onerror = failed;
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * "Store files in a folder that was shared with us": paste the folder's link,
 * then confirm it in Google's own window. Picking it there is what lets the
 * tracker add files to it, without asking for access to the rest of Drive.
 */
export function SharedFolderPicker({
  app,
  email,
  current,
}: {
  app: string;
  /** The connected account; the folder must be shared with it. */
  email: string;
  current: { name: string; owner: string } | null;
}) {
  const { busy, result, setResult, run } = useApiAction();
  const [link, setLink] = useState("");

  const choose = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const folderId = link.trim() ? folderIdFromLink(link) : null;
    if (link.trim() && !folderId) {
      setResult({ tone: "critical", text: "That does not look like a Google Drive folder link. Open the folder in Drive and copy the address." });
      return;
    }
    setResult(null);
    try {
      const response = await postJson("/api/drive/folder", { app, action: "session" });
      if (response.ok === false || response.error) throw new Error(response.error ?? "The folder picker could not be opened.");
      const session = (response as { session: { token: string; apiKey: string; appId: string } }).session;
      const picker = await loadPicker();

      const folders = () =>
        new picker.DocsView(picker.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true).setMimeTypes(FOLDER);
      const builder = new picker.PickerBuilder()
        .setOAuthToken(session.token)
        .setDeveloperKey(session.apiKey)
        .setAppId(session.appId)
        .setTitle("Choose the folder for uploads, then press Select")
        .setCallback((data) => {
          if (data.action !== picker.Action.PICKED || !data.docs?.[0]) return;
          void run("use", () => postJson("/api/drive/folder", { app, action: "use", folderId: data.docs![0].id }));
        });
      // The view setters change the view in place, so optional ones can simply be skipped.
      const view = (setUp: (view: PickerView) => void) => {
        const made = folders();
        setUp(made);
        builder.addView(made);
      };
      if (folderId && folders().setFileIds) {
        // Just the pasted folder, so it is one click.
        view((made) => made.setFileIds!(folderId));
      } else {
        view((made) => (made.setOwnedByMe?.(false), made.setLabel?.("Shared with me")));
        view((made) => (made.setOwnedByMe?.(true), made.setLabel?.("My Drive")));
        view((made) => (made.setEnableDrives?.(true), made.setLabel?.("Shared drives")));
      }
      builder.build().setVisible(true);
    } catch (error) {
      setResult({ tone: "critical", text: (error as Error).message });
    }
  };

  return (
    <div className="space-y-3">
      {current ? (
        <p>
          Uploads go into the shared folder <span className="font-medium text-slate-800">“{current.name}”</span>
          {current.owner ? <> (owned by {current.owner})</> : null}, as {email}.
        </p>
      ) : null}
      <form onSubmit={choose} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Field
          label={current ? "Use a different folder" : "Folder link"}
          htmlFor={`${app}-folder-link`}
          hint={`Open the folder in Google Drive and copy the address. It must be shared with ${email} as an Editor.`}
          className="flex-1"
        >
          <Input
            id={`${app}-folder-link`}
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://drive.google.com/drive/folders/…"
          />
        </Field>
        <Button type="submit" size="sm" disabled={busy !== null} className="sm:mb-6">
          {busy === "use" ? "Checking the folder…" : link.trim() ? "Use this folder" : "Browse folders"}
        </Button>
      </form>
      {current ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy !== null}
          onClick={() => run("stop", () => postJson("/api/drive/folder", { app, action: "stop" }))}
        >
          Stop using the shared folder
        </Button>
      ) : null}
      {result ? <Alert tone={result.tone}>{result.text}</Alert> : null}
    </div>
  );
}
