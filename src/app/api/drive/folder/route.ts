import { failure, success } from "@/lib/api/respond";
import { folderIdFromLink } from "@/lib/files/folder-link";
import { getCurrentUser } from "@/lib/services/auth";
import { DRIVE_APPS, driveAppFor } from "@/lib/services/drive-apps";
import { folderPickerSession, stopUsingSharedFolder, chooseSharedFolder } from "@/lib/services/storage";

/**
 * Filing an app's uploads into a folder someone shared with the connected
 * Google account. `session` gives Google's folder picker what it needs,
 * `use` checks and saves the folder picked, `stop` goes back to the app's own
 * folder. Only that app's administrators.
 */
export async function POST(request: Request): Promise<Response> {
  let body: { app?: string; action?: string; folderId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return failure("Send JSON.", 400);
  }
  const app = driveAppFor(body.app ?? null);
  if (!app) return failure("Unknown app.", 400);
  const user = await getCurrentUser();
  if (!user) return failure("Not signed in.", 401);
  if (!DRIVE_APPS[app].allowed(user)) return failure(`Only ${DRIVE_APPS[app].who} can choose where files are stored.`, 403);

  try {
    switch (body.action) {
      case "session":
        return success("Ready.", { session: await folderPickerSession(app) });
      case "use": {
        const folderId = folderIdFromLink(body.folderId ?? "");
        if (!folderId) return failure("Choose a folder.", 400);
        const folder = await chooseSharedFolder(app, folderId, user.email || user.name);
        return success(`New uploads will be filed in “${folder.name}”.`);
      }
      case "stop":
        await stopUsingSharedFolder(app);
        return success("New uploads go back to the tracker's own folder. Files already in the shared folder stay there.");
      default:
        return failure("Unknown action.", 400);
    }
  } catch (error) {
    return failure(error);
  }
}
