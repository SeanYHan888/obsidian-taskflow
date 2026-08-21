import {classifyString, sortGenericItemsInplace} from './helpers'
import {buildTodoTree} from './hierarchy'

import type {TodoItem, TodoGroup, GroupByType, SortDirection} from 'src/_types'
export const groupTodos = (
  items: TodoItem[],
  groupBy: GroupByType,
  sortGroups: SortDirection,
  sortItems: SortDirection,
  subGroups: boolean,
  subGroupSort: SortDirection,
): TodoGroup[] => {
  const groups: TodoGroup[] = []
  for (const item of items) {
    const itemKey =
      groupBy === 'page'
        ? item.filePath
        : `#${[item.mainTag, item.subTag].filter(e => e != null).join('/')}`
    let group = groups.find(g => g.id === itemKey)
    if (!group) {
      const newGroup: TodoGroup = {
        id: itemKey,
        sortName: '',
        className: '',
        type: groupBy,
        todos: [],
        itemCount: 0,
        oldestItem: Infinity,
        newestItem: 0,
      }

      if (newGroup.type === 'page') {
        newGroup.pageName = item.fileLabel
        newGroup.sortName = item.fileLabel
        newGroup.className = classifyString(item.fileLabel)
      } else if (newGroup.type === 'tag') {
        newGroup.mainTag = item.mainTag
        newGroup.subTags = item.subTag
        newGroup.sortName = item.mainTag + (item.subTag ?? '0')
        newGroup.className = classifyString(
          (newGroup.mainTag ?? '') + (newGroup.subTags ?? ''),
        )
      }
      groups.push(newGroup)
      group = newGroup
    }
    if (group.newestItem < item.fileCreatedTs)
      group.newestItem = item.fileCreatedTs
    if (group.oldestItem > item.fileCreatedTs)
      group.oldestItem = item.fileCreatedTs

    group.todos.push(item)
    group.itemCount += 1
  }

  const nonEmptyGroups = groups.filter(g => g.todos.length > 0)

  sortGenericItemsInplace(
    nonEmptyGroups,
    sortGroups,
    'sortName',
    sortGroups === 'new->old' ? 'newestItem' : 'oldestItem',
  )

  if (!subGroups)
    for (const g of groups) {
      g.todos = buildTodoTree(g.todos)
      sortTodoTreeInplace(g.todos, sortItems)
    }
  else
    for (const g of nonEmptyGroups)
      g.groups = groupTodos(
        g.todos,
        groupBy === 'page' ? 'tag' : 'page',
        subGroupSort,
        sortItems,
        false,
        'a->z',
      )

  return nonEmptyGroups
}

const sortTodoTreeInplace = (todos: TodoItem[], direction: SortDirection) => {
  sortGenericItemsInplace(todos, direction, 'originalText', 'fileCreatedTs')
  for (const todo of todos) sortTodoTreeInplace(todo.children, direction)
}
