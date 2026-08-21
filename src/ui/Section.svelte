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
    onCollapse,
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
    onCollapse: (key: SectionKey, collapsed: boolean) => void
    children: Snippet
  } = $props()
</script>

<section class="taskflow-section">
  <button class="taskflow-section-header" onclick={() => onCollapse(key, !collapsed)}>
    <span class="taskflow-collapse-icon" class:taskflow-collapsed={collapsed}>›</span>
    <span class="taskflow-section-title">{title}</span>
    <span class="taskflow-count" class:taskflow-count-danger={danger && count > 0}>
      {count}
    </span>
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
        <div class="taskflow-empty">Nothing here</div>
      {:else}
        {@render children()}
      {/if}
    </div>
  {/if}
</section>
