"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders overlays at the end of `<body>`.
 *
 * A `position: fixed` element is normally sized to the viewport — unless an
 * ancestor uses `filter`, `transform` or `backdrop-filter`, which quietly make
 * that ancestor the containing block instead. The top bar uses a backdrop
 * blur, so a drawer opened from it was being sized to the 64px header rather
 * than the screen. Putting overlays outside that tree removes the whole class
 * of problem.
 */
const noop = () => () => {};

export function Portal({ children }: { children: ReactNode }) {
  // There is no `document` while rendering on the server, so the portal waits
  // for the browser. Subscribing to a store that never changes is the
  // hydration-safe way to ask "am I on the client yet".
  const onClient = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

  if (!onClient) return null;
  return createPortal(children, document.body);
}
