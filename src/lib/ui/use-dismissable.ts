"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Open/close behaviour shared by every pop-over in the app: close on Escape,
 * close on a click outside, and close when the person navigates.
 *
 * "Open" is stored as the route it was opened on rather than a boolean, so
 * following a link closes the panel without an effect watching the pathname.
 */
export function useDismissable<T extends HTMLElement>() {
  const pathname = usePathname();
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const container = useRef<T>(null);
  const open = openedOn === pathname;

  const close = useCallback(() => setOpenedOn(null), []);
  const toggle = useCallback(() => setOpenedOn((current) => (current ? null : pathname)), [pathname]);
  const show = useCallback(() => setOpenedOn(pathname), [pathname]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      // Panels that fill the screen have no container to be "outside" of.
      if (!container.current) return;
      if (!container.current.contains(event.target as Node)) setOpenedOn(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenedOn(null);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return { container, open, toggle, close, show };
}
