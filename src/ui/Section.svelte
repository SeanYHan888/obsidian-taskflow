<script lang="ts">
  import {stillInside} from './dnd'
  import {icon} from './icon'

  import type {Snippet} from 'svelte'
  import type {SectionKey} from '../settings'

  let {
    title,
    key,
    count,
    collapsed,
    danger = false,
    badge = null,
    badgeDanger = false,
    onMenu = null,
    emptyText = 'Nothing here',
    onCollapse,
    dragActive = false,
    onDropTask = null,
    children,
  }: {
    title: string
    key: SectionKey
    count: number
    collapsed: boolean
    danger?: boolean
    badge?: string | null
    badgeDanger?: boolean
    /** The header's "…" menu; absent when the section has no acts. */
    onMenu?: ((ev: MouseEvent) => void) | null
    emptyText?: string
    onCollapse: (key: SectionKey, collapsed: boolean) => void
    /** True while a row is lifted somewhere in the panel. */
    dragActive?: boolean
    /** Present when this section's header is a drop target. */
    onDropTask?: ((ev: DragEvent) => void) | null
    children: Snippet
  } = $props()

  let dragOver = $state(false)
  const droppable = $derived(dragActive && onDropTask != null)
</script>

<!-- The whole section catches drops, not just the header line — a drop
     anywhere over the section means the same thing. -->
<section
  class="taskflow-section"
  class:taskflow-drop-ready={droppable}
  class:taskflow-drop-over={droppable && dragOver}
  role={droppable ? 'region' : undefined}
  ondragenter={ev => {
    if (droppable) ev.preventDefault()
  }}
  ondragover={ev => {
    if (!droppable) return
    ev.preventDefault()
    dragOver = true
  }}
  ondragleave={ev => {
    if (stillInside(ev)) return
    dragOver = false
  }}
  ondrop={ev => {
    if (!droppable) return
    ev.preventDefault()
    dragOver = false
    onDropTask?.(ev)
  }}
>
  <!-- Fold and the header action are sibling buttons, never nested
       interactive content — each is real, focusable, and screen-readable. -->
  <!-- The highlight rings the whole section, exactly the surface that
       catches the drop — the header alone undersold the target. -->
  <div class="taskflow-section-header">
    <button
      class="taskflow-section-toggle"
      aria-expanded={!collapsed}
      onclick={() => onCollapse(key, !collapsed)}
    >
      <span
        class="taskflow-collapse-icon"
        class:taskflow-collapsed={collapsed}
        aria-hidden="true"
        use:icon={'chevron-right'}
      ></span>
      <span class="taskflow-section-title">{title}</span>
      {#if count > 0}
        <span class="taskflow-count" class:taskflow-count-danger={danger}>
          {count}
        </span>
      {/if}
      <!-- Signals sit with identity (panel grammar): the badge is information
           like the count, so it lives beside it — the right edge holds acts. -->
      {#if badge}
        <span class="taskflow-badge" class:taskflow-badge-danger={badgeDanger}>{badge}</span>
      {/if}
    </button>
    {#if onMenu && count > 0 && !collapsed}
      <button
        class="taskflow-section-menu"
        aria-label="Section actions"
        onclick={ev => onMenu(ev)}
        use:icon={'more-horizontal'}
      ></button>
    {/if}
  </div>
  {#if !collapsed}
    <div class="taskflow-section-body">
      {#if count === 0}
        <div class="taskflow-empty">{emptyText}</div>
      {:else}
        {@render children()}
      {/if}
    </div>
  {/if}
</section>
