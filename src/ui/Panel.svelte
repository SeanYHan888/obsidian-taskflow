<script lang="ts">
  import Section from './Section.svelte'
  import TaskRow from './TaskRow.svelte'
  import {stillInside} from './dnd'
  import {dropIntent} from '../core/drop'
  import {countTaskTree, locationKey} from '../core/hierarchy'
  import {chipLabel} from '../core/schedule'
  import {pruneSelection, sectionCounts, selectionTasks, wipBadge} from '../core/sections'

  import type {DropTarget} from '../core/drop'
  import type {TaskflowTask} from '../core/types'
  import type {PanelCallbacks, PanelData, RowContext} from './panel-types'

  let {callbacks}: {callbacks: PanelCallbacks} = $props()

  let data: PanelData = $state({
    sections: null,
    setup: [],
    today: '',
    wipLimit: 3,
    collapsed: {},
    collapsedProjects: {},
    draggable: false,
    machineNotePath: '',
    projectsFolder: '',
    templatePath: '',
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
      machineNotePath: data.machineNotePath,
      projectsFolder: data.projectsFolder,
      today: data.today,
    }).kind !== 'none'

  export const update = (next: PanelData) => {
    data = next
    selectedKeys = pruneSelection(next.sections, selectedKeys)
  }

  const selectedTasks = $derived(selectionTasks(data.sections, selectedKeys))

  /** One select mode for the whole panel — either header's toggle drives it. */
  const toggleSelecting = () => {
    selecting = !selecting
    if (!selecting) selectedKeys = new Set()
  }

  const toggleSelect = (task: {filePath: string; line: number}) => {
    const key = locationKey(task.filePath, task.line)
    const next = new Set(selectedKeys)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    selectedKeys = next
  }

  const counts = $derived(sectionCounts(data.sections))

  const ctx: RowContext = $derived({
    today: data.today,
    machineNotePath: data.machineNotePath,
    draggable: data.draggable,
    onDragStart: (task: TaskflowTask) => (dragTask = task),
    onDragEnd: () => {
      dragTask = null
      dragOverProject = null
    },
    callbacks,
  })

  const wip = $derived(wipBadge(data.sections, data.wipLimit))

  // Empty states teach (#6): each says what would appear and how to get it
  // there, in the glossary's vocabulary — never four identical silences.
  const todoEmpty = $derived(
    data.setup.includes('daily-notes-unconfigured')
      ? 'Nothing to do yet. Turn on the core Daily Notes plugin to capture into an inbox, or schedule any task for today.'
      : "Nothing to do — capture in today's note or pull from a project",
  )
  const projectsEmpty = $derived(
    data.setup.includes('projects-folder-missing')
      ? `Projects are notes in "${data.projectsFolder}" with a status field (now, next, or later). Create the folder when you're ready — everything above works without it.`
      : 'No open project tasks',
  )
</script>

<div class="taskflow-panel">
  {#if data.setup.includes('tasks-plugin-missing')}
    <div class="taskflow-missing">
      Taskflow needs the Tasks plugin (emoji format) to read your vault's
      tasks. Install and enable "Tasks" from the community plugins, and the
      panel will pick it up.
    </div>
  {:else if data.sections}
    <Section
      title="To-do"
      key="today"
      count={counts.today + counts.inbox}
      collapsed={data.collapsed.today ?? false}
      emptyText={todoEmpty}
      actionLabel={selecting ? 'done' : 'select'}
      onAction={toggleSelecting}
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
      emptyText="Nothing scheduled ahead — tasks dated later wait here instead of disappearing"
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
      emptyText={projectsEmpty}
      badge={wip?.label ?? null}
      badgeDanger={wip?.danger ?? false}
      actionLabel={selecting ? 'done' : 'select'}
      onAction={toggleSelecting}
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
            if (stillInside(ev)) return
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
              onclick={ev => callbacks.onProjectToggle(group.project.path, folded, ev)}
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
              <TaskRow
                {task}
                {ctx}
                showSource={false}
                quickToday
                selectMode={selecting}
                {selectedKeys}
                onToggleSelect={toggleSelect}
              />
            {/each}
          {/if}
        </div>
      {/each}
    </Section>

    <!-- One bar for the one selection, wherever its rows live — it follows
         the panel bottom so a backlog-only selection still has its actions. -->
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

    {#if data.setup.includes('template-missing')}
      <div class="taskflow-setup-hint">
        Project template not found at "{data.templatePath}" — "New project…"
        will use the built-in scaffold.
      </div>
    {/if}
  {:else}
    <div class="taskflow-empty">Reading tasks…</div>
  {/if}
</div>
