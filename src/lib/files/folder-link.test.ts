import { describe, expect, it } from "vitest";

import { folderIdFromLink } from "@/lib/files/folder-link";

describe("folderIdFromLink", () => {
  const id = "1AbCdEfGhIjKlMnOpQrStUvWxYz_-12";

  it("reads the links Drive gives you", () => {
    expect(folderIdFromLink(`https://drive.google.com/drive/folders/${id}?usp=sharing`)).toBe(id);
    expect(folderIdFromLink(`https://drive.google.com/drive/u/1/folders/${id}`)).toBe(id);
    expect(folderIdFromLink(`https://drive.google.com/open?id=${id}`)).toBe(id);
    expect(folderIdFromLink(`  ${id}  `)).toBe(id);
  });

  it("refuses anything that is not a Drive folder", () => {
    expect(folderIdFromLink("https://evil.example/drive/folders/" + id)).toBeNull();
    expect(folderIdFromLink("https://drive.google.com/file/d/")).toBeNull();
    expect(folderIdFromLink("not a link")).toBeNull();
    expect(folderIdFromLink("")).toBeNull();
  });
});
