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
    quickToday = false,
    nested = false,
  }: {
    task: TaskflowTask
    ctx: RowContext
    showSource?: boolean
    slippedActions?: boolean
    selectMode?: boolean
    selectedKeys?: ReadonlySet<string> | null
    onToggleSelect?: ((task: TaskflowTask) => void) | null
    quickToday?: boolean
    nested?: boolean
  } = $props()

  // The structural ADR-0003 guard: Apple Sync tasks get check-off only,
  // regardless of which section rendered this row — including select mode,
  // which the merged To-do section now extends over its reminders.
  const canSchedule = $derived(task.filePath !== ctx.appleSyncPath && !selectMode)
  const selectable = $derived(
    selectMode && onToggleSelect != null && task.filePath !== ctx.appleSyncPath,
  )
  // Apple Sync rows refuse to lift — the same structural guard as canSchedule.
  const rowDraggable = $derived(
    ctx.draggable && !selectMode && task.filePath !== ctx.appleSyncPath,
  )
  const selected = $derived(
    selectedKeys?.has(locationKey(task.filePath, task.line)) ?? false,
  )

  const chipText = (date: string) => (date === ctx.today ? 'today' : date.slice(5))
  const sourceLabel = $derived(
    ctx.sourceLabels[task.filePath] ?? task.filePath.split('/').pop() ?? '',
  )
</script>

<div class="taskflow-item" class:taskflow-item-nested={nested}>
<div
  class="taskflow-row"
  class:taskflow-row-selected={selected}
  draggable={rowDraggable}
  role={rowDraggable ? 'listitem' : undefined}
  ondragstart={ev => {
    ev.dataTransfer?.setData('text/plain', task.description)
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'
    ctx.onDragStart(task)
  }}
  ondragend={() => ctx.onDragEnd()}
>
  {#if selectable && onToggleSelect}
    <button
      class="taskflow-select-box"
      class:taskflow-selected={selected}
      role="checkbox"
      aria-checked={selected}
      aria-label="Select task"
      onclick={() => onToggleSelect(task)}
    >{selected ? '✓' : ''}</button>
  {:else}
    <button
      class="taskflow-check"
      aria-label="Complete task"
      onclick={() => ctx.callbacks.onToggleTask(task)}
    ></button>
  {/if}
  <button
    class="taskflow-text"
    onclick={() =>
      selectable && onToggleSelect ? onToggleSelect(task) : ctx.callbacks.onOpenTask(task)}
  >
    <span class="taskflow-desc">{task.description}</span>
    {#if showSource}
      <span class="taskflow-source">{sourceLabel}</span>
    {/if}
  </button>
  {#if task.due != null}
    {#if canSchedule}
      <button
        class="taskflow-chip taskflow-chip-button taskflow-chip-due"
        class:taskflow-chip-past={task.due <= ctx.today}
        aria-label="Schedule task"
        onclick={ev => ctx.callbacks.onScheduleMenu(task, ev)}
      >
        {chipText(task.due)}
      </button>
    {:else}
      <span
        class="taskflow-chip taskflow-chip-due"
        class:taskflow-chip-past={task.due <= ctx.today}
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
  {#if quickToday && canSchedule}
    {#if task.scheduled === ctx.today}
      <button
        class="taskflow-quick-today taskflow-quick-today-undo"
        aria-label="Remove from To-do"
        onclick={() => ctx.callbacks.onUnschedule(task)}
      >
        ✕ to-do
      </button>
    {:else}
      <button
        class="taskflow-quick-today"
        aria-label="Move to To-do"
        onclick={() => ctx.callbacks.onSchedule(task, 'today')}
      >
        → to-do
      </button>
    {/if}
  {/if}
</div>
{#if slippedActions && canSchedule}
  <div class="taskflow-actions">
    <button class="taskflow-action" onclick={() => ctx.callbacks.onSchedule(task, 'today')}>
      to-do
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
        {quickToday}
        nested
      />
    {/each}
  </div>
{/if}
</div>
