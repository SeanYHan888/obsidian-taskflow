<script lang="ts">
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
    actionLabel = null,
    onAction = null,
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
    actionLabel?: string | null
    onAction?: (() => void) | null
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

<section class="taskflow-section">
  <button
    class="taskflow-section-header"
    class:taskflow-drop-ready={droppable}
    class:taskflow-drop-over={droppable && dragOver}
    onclick={() => onCollapse(key, !collapsed)}
    ondragover={ev => {
      if (!droppable) return
      ev.preventDefault()
      dragOver = true
    }}
    ondragleave={() => (dragOver = false)}
    ondrop={ev => {
      if (!droppable) return
      ev.preventDefault()
      dragOver = false
      onDropTask?.(ev)
    }}
  >
    <span class="taskflow-collapse-icon" class:taskflow-collapsed={collapsed}>›</span>
    <span class="taskflow-section-title">{title}</span>
    {#if count > 0}
      <span class="taskflow-count" class:taskflow-count-danger={danger}>
        {count}
      </span>
    {/if}
    {#if actionLabel && onAction && count > 0 && !collapsed}
      <span
        class="taskflow-header-action"
        role="button"
        tabindex="0"
        onclick={ev => {
          ev.stopPropagation()
          onAction()
        }}
        onkeydown={ev => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.stopPropagation()
            ev.preventDefault()
            onAction()
          }
        }}
      >
        {actionLabel}
      </span>
    {/if}
    {#if badge}
      <span class="taskflow-badge" class:taskflow-badge-danger={badgeDanger}>{badge}</span>
    {/if}
  </button>
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
