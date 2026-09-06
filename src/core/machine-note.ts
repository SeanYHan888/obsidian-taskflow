/**
 * The machine-managed note: a note some external tool rewrites on its own
 * schedule. Apple Reminders sync is one instance, not a special case — any
 * sync tool that owns a note fits. Two rules follow from "machine-rewritten":
 * its ⏳-dated lines are calendar blocks, not tasks (ADR-0003), and every
 * panel edit except check-off would be clobbered on the next rewrite, so its
 * rows are read-only. A vault without such a note leaves the path blank and
 * both rules disable.
 */

export type MachineNoteConfig = {
  /** Path of the machine-managed note, or '' when the vault has none. */
  machineNotePath: string
}

export const isMachineManaged = (filePath: string, config: MachineNoteConfig): boolean =>
  config.machineNotePath !== '' && filePath === config.machineNotePath

/** ⏳-dated lines in the machine-managed note are time blocks, never tasks. */
export const isCalendarBlock = (
  task: {filePath: string; scheduled: string | null},
  config: MachineNoteConfig,
): boolean => isMachineManaged(task.filePath, config) && task.scheduled != null

/** The bulk-action backstop: machine-managed rows never join a line edit. */
export const editableTasks = <T extends {filePath: string}>(
  tasks: T[],
  config: MachineNoteConfig,
): T[] => tasks.filter(t => !isMachineManaged(t.filePath, config))

export type RowAffordances = {
  /** Date chips clickable and the add-date button shown. */
  canSchedule: boolean
  /** May join a selection — machine-managed rows never do. */
  selectable: boolean
  draggable: boolean
  /** A due date is a debt the day it arrives (`<=`). */
  duePast: boolean
  /** A scheduled day slips only once it is over (`<`). */
  scheduledPast: boolean
}

/**
 * What one row offers, regardless of which section rendered it. The single
 * home of the read-only guard and of the chip past-ness boundaries — the
 * asymmetry between due (`<=`) and scheduled (`<`) is the same urgency
 * grammar classify uses for sections.
 */
export const rowAffordances = (
  task: {filePath: string; due: string | null; scheduled: string | null},
  opts: MachineNoteConfig & {today: string; selectMode: boolean; dragEnabled: boolean},
): RowAffordances => {
  const managed = isMachineManaged(task.filePath, opts)
  return {
    canSchedule: !managed && !opts.selectMode,
    selectable: opts.selectMode && !managed,
    draggable: opts.dragEnabled && !opts.selectMode && !managed,
    duePast: task.due != null && task.due <= opts.today,
    scheduledPast: task.scheduled != null && task.scheduled < opts.today,
  }
}
