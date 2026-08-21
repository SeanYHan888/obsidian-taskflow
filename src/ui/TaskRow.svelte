<script lang="ts">
  import TaskRow from './TaskRow.svelte'
  import {locationKey} from '../core/hierarchy'

  import type {TaskflowTask} from '../core/types'
  import type {PanelCallbacks} from './panel-types'

  let {
    task,
    today,
    sourceLabels,
    callbacks,
    showSource = true,
    canSchedule = true,
    slippedActions = false,
  }: {
    task: TaskflowTask
    today: string
    sourceLabels: Record<string, string>
    callbacks: PanelCallbacks
    showSource?: boolean
    canSchedule?: boolean
    slippedActions?: boolean
  } = $props()

  const chipText = (date: string) => (date === today ? 'today' : date.slice(5))
  const sourceLabel = $derived(
    sourceLabels[task.filePath] ?? task.filePath.split('/').pop() ?? '',
  )
</script>

<div class="taskflow-row">
  <button
    class="taskflow-check"
    aria-label="Complete task"
    onclick={() => callbacks.onToggleTask(task)}
  ></button>
  <button class="taskflow-text" onclick={() => callbacks.onOpenTask(task)}>
    <span class="taskflow-desc">{task.description}</span>
    {#if showSource}
      <span class="taskflow-source">{sourceLabel}</span>
    {/if}
  </button>
  {#if task.due != null}
    <span
      class="taskflow-chip taskflow-chip-due"
      class:taskflow-chip-past={task.due < today}
    >
      {chipText(task.due)}
    </span>
  {/if}
  {#if task.scheduled != null}
    {#if canSchedule}
      <button
        class="taskflow-chip taskflow-chip-button"
        class:taskflow-chip-past={task.scheduled < today}
        aria-label="Reschedule"
        onclick={ev => callbacks.onScheduleMenu(task, ev)}
      >
        {chipText(task.scheduled)}
      </button>
    {:else}
      <span
        class="taskflow-chip"
        class:taskflow-chip-past={task.scheduled < today}
      >
        {chipText(task.scheduled)}
      </span>
    {/if}
  {:else if canSchedule}
    <button
      class="taskflow-add-date"
      aria-label="Schedule task"
      onclick={ev => callbacks.onScheduleMenu(task, ev)}
    >
      ⏳
    </button>
  {/if}
</div>
{#if slippedActions && canSchedule}
  <div class="taskflow-actions">
    <button class="taskflow-action" onclick={() => callbacks.onSchedule(task, 'today')}>
      today
    </button>
    <button class="taskflow-action" onclick={() => callbacks.onSchedule(task, 'tomorrow')}>
      tomorrow
    </button>
    <button
      class="taskflow-action"
      aria-label="Pick a date"
      onclick={() => callbacks.onPickDate(task)}
    >
      📅
    </button>
    <button
      class="taskflow-action taskflow-action-danger"
      aria-label="Cancel task"
      onclick={() => callbacks.onCancelTask(task)}
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
        {today}
        {sourceLabels}
        {callbacks}
        {showSource}
        {canSchedule}
        {slippedActions}
      />
    {/each}
  </div>
{/if}
