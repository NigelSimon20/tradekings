/**
 * The folder id in a Google Drive folder link, as copied from the address bar
 * or "Share → Copy link":
 *   https://drive.google.com/drive/folders/1AbC…?usp=sharing
 *   https://drive.google.com/drive/u/0/folders/1AbC…
 *   https://drive.google.com/open?id=1AbC…
 * A bare id is accepted too. Anything else gives null.
 */
export function folderIdFromLink(text: string): string | null {
  const value = text.trim();
  if (!value) return null;
  const bare = /^[\w-]{10,}$/;
  if (bare.test(value)) return value;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!/(^|\.)drive\.google\.com$/.test(url.hostname)) return null;
  const fromPath = /\/folders\/([\w-]{10,})/.exec(url.pathname)?.[1];
  const fromQuery = url.searchParams.get("id");
  const id = fromPath ?? fromQuery;
  return id && bare.test(id) ? id : null;
}
