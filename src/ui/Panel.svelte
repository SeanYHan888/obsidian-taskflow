<script lang="ts">
  import Section from './Section.svelte'
  import TaskRow from './TaskRow.svelte'
  import {countTaskTree, locationKey} from '../core/hierarchy'

  import type {PanelCallbacks, PanelData} from './panel-types'

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

  export const update = (next: PanelData) => {
    data = next
  }

  const counts = $derived({
    today: data.sections ? countTaskTree(data.sections.today) : 0,
    slipped: data.sections ? countTaskTree(data.sections.slipped) : 0,
    inbox: data.sections ? countTaskTree(data.sections.inbox) : 0,
    projects: data.sections
      ? data.sections.projects.reduce((sum, g) => sum + countTaskTree(g.tasks), 0)
      : 0,
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
        <TaskRow
          {task}
          today={data.today}
          sourceLabels={data.sourceLabels}
          {callbacks}
          canSchedule={task.filePath !== data.appleSyncPath}
        />
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
        <TaskRow
          {task}
          today={data.today}
          sourceLabels={data.sourceLabels}
          {callbacks}
          canSchedule={task.filePath !== data.appleSyncPath}
          slippedActions
        />
      {/each}
    </Section>

    <Section
      title="Inbox"
      key="inbox"
      count={counts.inbox}
      collapsed={data.collapsed.inbox ?? false}
      onCollapse={callbacks.onCollapse}
    >
      {#each data.sections.inbox as task (locationKey(task.filePath, task.line))}
        <TaskRow {task} today={data.today} sourceLabels={data.sourceLabels} {callbacks} />
      {/each}
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
            <TaskRow {task} today={data.today} sourceLabels={data.sourceLabels} {callbacks} showSource={false} />
          {/each}
        </div>
      {/each}
    </Section>
  {/if}
</div>
