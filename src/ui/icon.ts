import {setIcon} from 'obsidian'

/**
 * Svelte action rendering an Obsidian (Lucide) icon into the element —
 * the panel's glyphs come from the same set as the rest of the app, so
 * every theme's icon styling applies.
 */
export const icon = (el: HTMLElement, name: string) => {
  setIcon(el, name)
  return {
    update(next: string) {
      setIcon(el, next)
    },
  }
}
