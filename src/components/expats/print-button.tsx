"use client";

import { Button } from "@/components/ui/button";
import { PrintIcon } from "@/components/ui/icons";

/** Opens the browser's print dialog — print, or save as PDF. */
export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()}>
      <PrintIcon className="size-4" />
      Print or save as PDF
    </Button>
  );
}
