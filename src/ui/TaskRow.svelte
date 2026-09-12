<script lang="ts">
  import TaskRow from './TaskRow.svelte'
  import {icon} from './icon'
  import {locationKey} from '../core/hierarchy'
  import {sourceLabel as labelFor} from '../core/labels'
  import {rowAffordances} from '../core/machine-note'
  import {chipLabel, rowChip} from '../core/schedule'

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
    nested = false,
  }: {
    task: TaskflowTask
    ctx: RowContext
    showSource?: boolean
    slippedActions?: boolean
    selectMode?: boolean
    selectedKeys?: ReadonlySet<string> | null
    onToggleSelect?: ((task: TaskflowTask) => void) | null
    nested?: boolean
  } = $props()

  // Core owns the read-only guard (machine-managed rows get check-off only,
  // ADR-0003) and the chip past-ness boundaries — the row just renders them.
  const aff = $derived(
    rowAffordances(task, {
      machineNotePath: ctx.machineNotePath,
      today: ctx.today,
      selectMode,
      dragEnabled: ctx.draggable,
    }),
  )
  const canSchedule = $derived(aff.canSchedule)
  const selectable = $derived(aff.selectable && onToggleSelect != null)
  const rowDraggable = $derived(aff.draggable)
  const selected = $derived(
    selectedKeys?.has(locationKey(task.filePath, task.line)) ?? false,
  )

  const chipText = (date: string) => chipLabel(date, ctx.today)
  const sourceLabel = $derived(labelFor(task.filePath))
  // The chip rule (CONTEXT.md): one chip, the date that matters next; core decides which.
  const chip = $derived(rowChip(task, ctx.today))
</script>

<div class="taskflow-item" class:taskflow-item-nested={nested}>
<div
  class="taskflow-row"
  class:taskflow-row-selected={selected}
  draggable={rowDraggable}
  role="listitem"
  ondragstart={ev => {
    ev.dataTransfer?.setData('text/plain', task.description)
    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'
    ctx.onDragStart(task)
  }}
  ondragend={() => ctx.onDragEnd()}
  oncontextmenu={ev => {
    ev.preventDefault()
    ctx.callbacks.onRowMenu(task, ev, {selectable: onToggleSelect != null, selected})
  }}
>
  {#if selectable && onToggleSelect}
    <button
      class="taskflow-select-box"
      class:taskflow-selected={selected}
      role="checkbox"
      aria-checked={selected}
      aria-label="Select task"
      onclick={() => onToggleSelect(task)}
    >{#if selected}<span class="taskflow-select-mark" aria-hidden="true" use:icon={'check'}></span>{/if}</button>
  {:else}
    <button
      class="taskflow-check"
      aria-label="Complete task"
      onclick={() => ctx.callbacks.onToggleTask(task)}
    ></button>
  {/if}
  <button
    class="taskflow-text"
    onclick={ev =>
      selectable && onToggleSelect ? onToggleSelect(task) : ctx.callbacks.onOpenTask(task, ev)}
    onauxclick={ev => {
      if (ev.button === 1 && !(selectable && onToggleSelect)) ctx.callbacks.onOpenTask(task, ev)
    }}
  >
    <span class="taskflow-desc">{task.description}</span>
    {#if showSource}
      <span class="taskflow-source">{sourceLabel}</span>
    {/if}
  </button>
  <!-- One chip, the date that matters next (chip rule): the start while it
       is ahead, then the due, else the start. A chip opens what edits it —
       the start menu or the due menu — and the other field is edited from
       the row menu. -->
  {#if chip}
    {#if canSchedule}
      <button
        class="taskflow-chip taskflow-chip-button"
        class:taskflow-chip-due={chip.field === 'due'}
        class:taskflow-chip-past={chip.past}
        aria-label={chip.field === 'due' ? 'Edit due date' : 'Edit start'}
        onclick={ev =>
          chip.field === 'due'
            ? ctx.callbacks.onDueMenu(task, ev)
            : ctx.callbacks.onScheduleMenu(task, ev)}
      >
        {chipText(chip.date)}
      </button>
    {:else}
      <span
        class="taskflow-chip"
        class:taskflow-chip-due={chip.field === 'due'}
        class:taskflow-chip-past={chip.past}
      >
        {chipText(chip.date)}
      </span>
    {/if}
  {:else if canSchedule}
    <!-- A press that wanders must stay a click, never lift the row. -->
    <button
      class="taskflow-add-date"
      aria-label="Set start"
      onclick={ev => ctx.callbacks.onScheduleMenu(task, ev)}
      ondragstart={ev => {
        ev.preventDefault()
        ev.stopPropagation()
      }}
      use:icon={'calendar-plus'}
    ></button>
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
      use:icon={'calendar'}
    ></button>
    <button
      class="taskflow-action taskflow-action-danger"
      aria-label="Cancel task"
      onclick={() => ctx.callbacks.onCancelTask(task)}
      use:icon={'x'}
    ></button>
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
        nested
      />
    {/each}
  </div>
{/if}
</div>
