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
