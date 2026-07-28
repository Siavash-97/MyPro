import { useEffect, useRef } from 'react';

/** Guards a backdrop "click to close" handler against the mobile "ghost
 * click": after a touch tap opens an overlay, some browsers still fire a
 * trailing synthetic click at the same screen position, which now lands on
 * the overlay's backdrop and would immediately close it again. Ignoring
 * close-clicks within a brief window after opening (or after `resetKey`
 * changes, for components that stay mounted and swap content) avoids that.
 */
export function useDismissGuard(resetKey?: unknown, delayMs = 350) {
  const openedAt = useRef(Date.now());
  useEffect(() => {
    openedAt.current = Date.now();
  }, [resetKey]);
  return () => Date.now() - openedAt.current > delayMs;
}
