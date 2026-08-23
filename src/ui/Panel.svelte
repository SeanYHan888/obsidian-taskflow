<script lang="ts">
  import Section from './Section.svelte'
  import TaskRow from './TaskRow.svelte'
  import {dropIntent} from '../core/drop'
  import {countTaskTree, flattenTaskTree, locationKey} from '../core/hierarchy'
  import {chipLabel} from '../core/schedule'

  import type {DropTarget} from '../core/drop'
  import type {TaskflowTask} from '../core/types'
  import type {PanelCallbacks, PanelData, RowContext} from './panel-types'

  let {callbacks}: {callbacks: PanelCallbacks} = $props()

  let data: PanelData = $state({
    sections: null,
    tasksPluginMissing: false,
    today: '',
    wipLimit: 3,
    collapsed: {},
    collapsedProjects: {},
    draggable: false,
    sourceLabels: {},
    appleSyncPath: '',
    projectsFolder: '',
  })

  let selecting = $state(false)
  let selectedKeys: ReadonlySet<string> = $state(new Set())
  let dragTask: TaskflowTask | null = $state(null)
  let dragOverProject: string | null = $state(null)

  const dropOn = (target: DropTarget) => (ev: DragEvent) => {
    if (!dragTask) return
    callbacks.onDrop(dragTask, target, ev)
    dragTask = null
  }

  // Story 16: only targets whose drop would actually do something light up.
  const dropValid = (target: DropTarget): boolean =>
    dragTask != null &&
    dropIntent(dragTask, target, {
      appleSyncPath: data.appleSyncPath,
      projectsFolder: data.projectsFolder,
      today: data.today,
    }).kind !== 'none'

  export const update = (next: PanelData) => {
    data = next
    const valid = new Set(
      [
        ...flattenTaskTree(next.sections?.today ?? []),
        ...flattenTaskTree(next.sections?.inbox ?? []),
      ].map(t => locationKey(t.filePath, t.line)),
    )
    selectedKeys = new Set([...selectedKeys].filter(k => valid.has(k)))
  }

  const selectedTasks = $derived(
    data.sections
      ? [
          ...flattenTaskTree(data.sections.today),
          ...flattenTaskTree(data.sections.inbox),
        ].filter(t => selectedKeys.has(locationKey(t.filePath, t.line)))
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
    upcoming: data.sections ? countTaskTree(data.sections.upcoming) : 0,
    inbox: data.sections ? countTaskTree(data.sections.inbox) : 0,
    projects: data.sections
      ? data.sections.projects.reduce((sum, g) => sum + countTaskTree(g.tasks), 0)
      : 0,
  })

  const ctx: RowContext = $derived({
    today: data.today,
    sourceLabels: data.sourceLabels,
    appleSyncPath: data.appleSyncPath,
    draggable: data.draggable,
    onDragStart: (task: TaskflowTask) => (dragTask = task),
    onDragEnd: () => {
      dragTask = null
      dragOverProject = null
    },
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
      title="To-do"
      key="today"
      count={counts.today + counts.inbox}
      collapsed={data.collapsed.today ?? false}
      emptyText="Nothing to do — capture in today's note or pull from a project"
      actionLabel={selecting ? 'done' : 'select'}
      onAction={() => {
        selecting = !selecting
        if (!selecting) selectedKeys = new Set()
      }}
      onCollapse={callbacks.onCollapse}
      dragActive={dropValid({kind: 'section', key: 'today'})}
      onDropTask={dropOn({kind: 'section', key: 'today'})}
    >
      {#each data.sections.today as task (locationKey(task.filePath, task.line))}
        <TaskRow
          {task}
          {ctx}
          selectMode={selecting}
          {selectedKeys}
          onToggleSelect={toggleSelect}
        />
      {/each}
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
      title="Overdue & slipped"
      key="slipped"
      count={counts.slipped}
      collapsed={data.collapsed.slipped ?? false}
      danger
      emptyText="All caught up — nothing slipped"
      actionLabel="All → to-do"
      onAction={callbacks.onRescheduleAllSlipped}
      onCollapse={callbacks.onCollapse}
    >
      {#each data.sections.slipped as task (locationKey(task.filePath, task.line))}
        <TaskRow {task} {ctx} slippedActions />
      {/each}
    </Section>

    <Section
      title="Upcoming"
      key="upcoming"
      count={counts.upcoming}
      collapsed={data.collapsed.upcoming ?? true}
      emptyText="Nothing scheduled ahead"
      onCollapse={callbacks.onCollapse}
      dragActive={dropValid({kind: 'section', key: 'upcoming'})}
      onDropTask={dropOn({kind: 'section', key: 'upcoming'})}
    >
      {#each data.sections.upcoming as task (locationKey(task.filePath, task.line))}
        <TaskRow {task} {ctx} />
      {/each}
    </Section>

    <Section
      title="Projects"
      key="projects"
      count={counts.projects}
      collapsed={data.collapsed.projects ?? false}
      emptyText="No open project tasks"
      badge={wipBadge}
      badgeDanger={data.sections.wipNowCount > data.wipLimit}
      onCollapse={callbacks.onCollapse}
    >
      {#each data.sections.projects as group (group.project.path)}
        {@const folded = data.collapsedProjects[group.project.path] ?? false}
        <div
          class="taskflow-project"
          role="presentation"
          ondragenter={ev => {
            if (dropValid({kind: 'project', path: group.project.path})) ev.preventDefault()
          }}
          ondragover={ev => {
            if (!dropValid({kind: 'project', path: group.project.path})) return
            ev.preventDefault()
            dragOverProject = group.project.path
          }}
          ondragleave={ev => {
            if (ev.currentTarget instanceof Node && ev.relatedTarget instanceof Node) {
              if (ev.currentTarget.contains(ev.relatedTarget)) return
            }
            if (dragOverProject === group.project.path) dragOverProject = null
          }}
          ondrop={ev => {
            if (!dropValid({kind: 'project', path: group.project.path})) return
            ev.preventDefault()
            dragOverProject = null
            dropOn({kind: 'project', path: group.project.path})(ev)
          }}
        >
          <div
            class="taskflow-project-header"
            class:taskflow-drop-ready={dropValid({kind: 'project', path: group.project.path})}
            class:taskflow-drop-over={dragOverProject === group.project.path}
            oncontextmenu={ev => {
              ev.preventDefault()
              callbacks.onProjectMenu(group.project, ev)
            }}
          >
            <!-- Group headers fold, like section headers and every tree since
                 Finder — jumping to the note is the smaller, deliberate act:
                 the hover ↗, mod+click, middle-click, or the menu. -->
            <button
              class="taskflow-project-toggle"
              aria-expanded={!folded}
              onclick={ev =>
                ev.metaKey || ev.ctrlKey
                  ? callbacks.onOpenFile(group.project.path, ev)
                  : callbacks.onCollapseProject(group.project.path, !folded)}
              onauxclick={ev => {
                if (ev.button === 1) callbacks.onOpenFile(group.project.path, ev)
              }}
            >
              <span class="taskflow-collapse-icon" class:taskflow-collapsed={folded}>›</span>
              <span class="taskflow-project-name">{group.project.name}</span>
              {#if group.project.status}
                <span class="taskflow-status taskflow-status-{group.project.status}">
                  {group.project.status}
                </span>
              {/if}
              <span class="taskflow-project-count">{countTaskTree(group.tasks)}</span>
            </button>
            {#if group.project.deadline != null}
              <button
                class="taskflow-chip taskflow-chip-button taskflow-chip-due"
                class:taskflow-chip-past={group.urgency === 'arrived'}
                aria-label="Project deadline"
                onclick={ev => callbacks.onProjectMenu(group.project, ev)}
              >
                {chipLabel(group.project.deadline, data.today)}
              </button>
            {/if}
            <button
              class="taskflow-project-goto"
              aria-label="Open project note"
              onclick={ev => callbacks.onOpenFile(group.project.path, ev)}
            >
              ↗
            </button>
            <button
              class="taskflow-project-menu"
              aria-label="Project actions"
              onclick={ev => callbacks.onProjectMenu(group.project, ev)}
            >
              …
            </button>
          </div>
          {#if !folded}
            {#each group.tasks as task (locationKey(task.filePath, task.line))}
              <TaskRow {task} {ctx} showSource={false} quickToday />
            {/each}
          {/if}
        </div>
      {/each}
    </Section>
  {/if}
</div>
