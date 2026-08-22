<script lang="ts">
  import TaskRow from './TaskRow.svelte'
  import {locationKey} from '../core/hierarchy'

  import type {TaskflowTask} from '../core/types'
  import type {RowContext} from './panel-types'

  let {
    task,
    ctx,
    showSource = true,
    slippedActions = false,
    selectMode = false,
    selectedKeys = null,
    onToggleSelect = null,
  }: {
    task: TaskflowTask
    ctx: RowContext
    showSource?: boolean
    slippedActions?: boolean
    selectMode?: boolean
    selectedKeys?: ReadonlySet<string> | null
    onToggleSelect?: ((task: TaskflowTask) => void) | null
  } = $props()

  // The structural ADR-0003 guard: Apple Sync tasks get check-off only,
  // regardless of which section rendered this row.
  const canSchedule = $derived(task.filePath !== ctx.appleSyncPath && !selectMode)
  const selected = $derived(
    selectedKeys?.has(locationKey(task.filePath, task.line)) ?? false,
  )

  const chipText = (date: string) => (date === ctx.today ? 'today' : date.slice(5))
  const sourceLabel = $derived(
    ctx.sourceLabels[task.filePath] ?? task.filePath.split('/').pop() ?? '',
  )
</script>

<div class="taskflow-row" class:taskflow-row-selected={selected}>
  {#if selectMode && onToggleSelect}
    <button
      class="taskflow-select-box"
      class:taskflow-selected={selected}
      role="checkbox"
      aria-checked={selected}
      aria-label="Select task"
      onclick={() => onToggleSelect(task)}
    >{selected ? '✓' : ''}</button>
    <button class="taskflow-text" onclick={() => onToggleSelect(task)}>
      <span class="taskflow-desc">{task.description}</span>
      {#if showSource}
        <span class="taskflow-source">{sourceLabel}</span>
      {/if}
    </button>
  {:else}
    <button
      class="taskflow-check"
      aria-label="Complete task"
      onclick={() => ctx.callbacks.onToggleTask(task)}
    ></button>
    <button class="taskflow-text" onclick={() => ctx.callbacks.onOpenTask(task)}>
      <span class="taskflow-desc">{task.description}</span>
      {#if showSource}
        <span class="taskflow-source">{sourceLabel}</span>
      {/if}
    </button>
  {/if}
  {#if task.due != null}
    {#if canSchedule}
      <button
        class="taskflow-chip taskflow-chip-button taskflow-chip-due"
        class:taskflow-chip-past={task.due < ctx.today}
        aria-label="Schedule task"
        onclick={ev => ctx.callbacks.onScheduleMenu(task, ev)}
      >
        {chipText(task.due)}
      </button>
    {:else}
      <span
        class="taskflow-chip taskflow-chip-due"
        class:taskflow-chip-past={task.due < ctx.today}
      >
        {chipText(task.due)}
      </span>
    {/if}
  {/if}
  {#if task.scheduled != null}
    {#if canSchedule}
      <button
        class="taskflow-chip taskflow-chip-button"
        class:taskflow-chip-past={task.scheduled < ctx.today}
        aria-label="Reschedule"
        onclick={ev => ctx.callbacks.onScheduleMenu(task, ev)}
      >
        {chipText(task.scheduled)}
      </button>
    {:else}
      <span
        class="taskflow-chip"
        class:taskflow-chip-past={task.scheduled < ctx.today}
      >
        {chipText(task.scheduled)}
      </span>
    {/if}
  {:else if canSchedule && task.due == null}
    <button
      class="taskflow-add-date"
      aria-label="Schedule task"
      onclick={ev => ctx.callbacks.onScheduleMenu(task, ev)}
    >
      ⏳
    </button>
  {/if}
</div>
{#if slippedActions && canSchedule}
  <div class="taskflow-actions">
    <button class="taskflow-action" onclick={() => ctx.callbacks.onSchedule(task, 'today')}>
      today
    </button>
    <button class="taskflow-action" onclick={() => ctx.callbacks.onSchedule(task, 'tomorrow')}>
      tomorrow
    </button>
    <button
      class="taskflow-action"
      aria-label="Pick a date"
      onclick={() => ctx.callbacks.onPickDate(task)}
    >
      📅
    </button>
    <button
      class="taskflow-action taskflow-action-danger"
      aria-label="Cancel task"
      onclick={() => ctx.callbacks.onCancelTask(task)}
    >
      ✕
    </button>
  </div>
{/if}
{#if task.children.length > 0}
  <div class="taskflow-children">
    {#each task.children as child (locationKey(child.filePath, child.line))}
      <TaskRow
        task={child}
        {ctx}
        {showSource}
        {slippedActions}
        {selectMode}
        {selectedKeys}
        {onToggleSelect}
      />
    {/each}
  </div>
{/if}
