<script lang="ts">
  import Section from './Section.svelte'
  import TaskRow from './TaskRow.svelte'
  import {countTaskTree, flattenTaskTree, locationKey} from '../core/hierarchy'

  import type {PanelCallbacks, PanelData, RowContext} from './panel-types'

  let {callbacks}: {callbacks: PanelCallbacks} = $props()

  let data: PanelData = $state({
    sections: null,
    tasksPluginMissing: false,
    today: '',
    wipLimit: 3,
    collapsed: {},
    sourceLabels: {},
    appleSyncPath: '',
  })

  let selecting = $state(false)
  let selectedKeys: ReadonlySet<string> = $state(new Set())

  export const update = (next: PanelData) => {
    data = next
    const valid = new Set(
      flattenTaskTree(next.sections?.inbox ?? []).map(t => locationKey(t.filePath, t.line)),
    )
    selectedKeys = new Set([...selectedKeys].filter(k => valid.has(k)))
  }

  const selectedTasks = $derived(
    data.sections
      ? flattenTaskTree(data.sections.inbox).filter(t =>
          selectedKeys.has(locationKey(t.filePath, t.line)),
        )
      : [],
  )

  const toggleSelect = (task: {filePath: string; line: number}) => {
    const key = locationKey(task.filePath, task.line)
    const next = new Set(selectedKeys)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    selectedKeys = next
  }

  const counts = $derived({
    today: data.sections ? countTaskTree(data.sections.today) : 0,
    slipped: data.sections ? countTaskTree(data.sections.slipped) : 0,
    inbox: data.sections ? countTaskTree(data.sections.inbox) : 0,
    projects: data.sections
      ? data.sections.projects.reduce((sum, g) => sum + countTaskTree(g.tasks), 0)
      : 0,
  })

  const ctx: RowContext = $derived({
    today: data.today,
    sourceLabels: data.sourceLabels,
    appleSyncPath: data.appleSyncPath,
    callbacks,
  })

  const wipBadge = $derived(
    data.sections && data.sections.wipNowCount > 0
      ? `now ${data.sections.wipNowCount}/${data.wipLimit}`
      : null,
  )
</script>

<div class="taskflow-panel">
  {#if data.tasksPluginMissing}
    <div class="taskflow-missing">
      Taskflow needs the Tasks plugin (emoji format). Install and enable it, then
      reopen this panel.
    </div>
  {:else if data.sections}
    <Section
      title="Today"
      key="today"
      count={counts.today}
      collapsed={data.collapsed.today ?? false}
      onCollapse={callbacks.onCollapse}
    >
      {#each data.sections.today as task (locationKey(task.filePath, task.line))}
        <TaskRow {task} {ctx} />
      {/each}
    </Section>

    <Section
      title="Overdue & slipped"
      key="slipped"
      count={counts.slipped}
      collapsed={data.collapsed.slipped ?? false}
      danger
      actionLabel="All → today"
      onAction={callbacks.onRescheduleAllSlipped}
      onCollapse={callbacks.onCollapse}
    >
      {#each data.sections.slipped as task (locationKey(task.filePath, task.line))}
        <TaskRow {task} {ctx} slippedActions />
      {/each}
    </Section>

    <Section
      title="Inbox"
      key="inbox"
      count={counts.inbox}
      collapsed={data.collapsed.inbox ?? false}
      actionLabel={selecting ? 'done' : 'select'}
      onAction={() => {
        selecting = !selecting
        if (!selecting) selectedKeys = new Set()
      }}
      onCollapse={callbacks.onCollapse}
    >
      {#each data.sections.inbox as task (locationKey(task.filePath, task.line))}
        <TaskRow
          {task}
          {ctx}
          selectMode={selecting}
          {selectedKeys}
          onToggleSelect={toggleSelect}
        />
      {/each}
      {#if selecting && selectedTasks.length > 0}
        <div class="taskflow-select-bar">
          <span class="taskflow-select-count">{selectedTasks.length} selected</span>
          <button
            class="taskflow-action"
            onclick={() => callbacks.onBulkMove(selectedTasks)}
          >
            move to project
          </button>
          <button
            class="taskflow-action"
            aria-label="Schedule selected"
            onclick={ev => callbacks.onBulkScheduleMenu(selectedTasks, ev)}
          >
            ⏳
          </button>
        </div>
      {/if}
    </Section>

    <Section
      title="Projects"
      key="projects"
      count={counts.projects}
      collapsed={data.collapsed.projects ?? false}
      badge={wipBadge}
      badgeDanger={data.sections.wipNowCount > data.wipLimit}
      onCollapse={callbacks.onCollapse}
    >
      {#each data.sections.projects as group (group.project.path)}
        <div class="taskflow-project">
          <button
            class="taskflow-project-header"
            onclick={() => callbacks.onOpenFile(group.project.path)}
          >
            <span class="taskflow-project-name">{group.project.name}</span>
            {#if group.project.status}
              <span class="taskflow-status taskflow-status-{group.project.status}">
                {group.project.status}
              </span>
            {/if}
            <span class="taskflow-project-count">{countTaskTree(group.tasks)}</span>
          </button>
          {#each group.tasks as task (locationKey(task.filePath, task.line))}
            <TaskRow {task} {ctx} showSource={false} />
          {/each}
        </div>
      {/each}
    </Section>
  {/if}
</div>
