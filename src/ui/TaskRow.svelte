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
  }: {
    task: TaskflowTask
    today: string
    sourceLabels: Record<string, string>
    callbacks: PanelCallbacks
    showSource?: boolean
  } = $props()

  const chip = $derived(
    task.due != null
      ? {kind: 'due', date: task.due}
      : task.scheduled != null
        ? {kind: 'scheduled', date: task.scheduled}
        : null,
  )

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
  {#if chip}
    <span
      class="taskflow-chip"
      class:taskflow-chip-due={chip.kind === 'due'}
      class:taskflow-chip-past={chip.date < today}
    >
      {chipText(chip.date)}
    </span>
  {/if}
</div>
{#if task.children.length > 0}
  <div class="taskflow-children">
    {#each task.children as child (locationKey(child.filePath, child.line))}
      <TaskRow task={child} {today} {sourceLabels} {callbacks} {showSource} />
    {/each}
  </div>
{/if}
