/**
 * True when a dragleave only crossed into a child of the same container —
 * the pointer is still inside, so the drop highlight must not flicker off.
 */
export const stillInside = (ev: DragEvent): boolean =>
  ev.currentTarget instanceof Node &&
  ev.relatedTarget instanceof Node &&
  ev.currentTarget.contains(ev.relatedTarget)
