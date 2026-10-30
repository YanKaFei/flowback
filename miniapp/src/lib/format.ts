import type { RiskRecord, RiskType, TaskStatus } from '@/types'

export function ownerText(owner: string | null): string {
  return owner?.trim() || '未指派'
}

export function dueText(dueLabel: string | null, dueDate: string | null): string {
  if (dueDate) {
    const [, month, day] = dueDate.split('-')
    return `${Number(month)}月${Number(day)}日`
  }
  return dueLabel?.trim() || '日期未定'
}

export function statusText(status: TaskStatus): string {
  if (status === 'doing') return '进行中'
  if (status === 'done') return '已完成'
  return '待完成'
}

export function riskTypeText(type: RiskType): string {
  switch (type) {
    case 'owner_gap':
      return '缺少负责人'
    case 'due_conflict':
      return '截止时间冲突'
    case 'due_unclear':
      return '截止时间待确认'
    case 'decision_unconfirmed':
      return '需要确认'
    default:
      return '需要确认'
  }
}

export function riskHint(risk: RiskRecord): string {
  switch (risk.type) {
    case 'owner_gap':
      return '缺少负责人'
    case 'due_conflict':
      return '截止时间冲突'
    case 'due_unclear':
      return '截止时间待确认'
    case 'decision_unconfirmed':
      return '需要确认'
    default:
      return risk.title
  }
}

export function severityText(severity: string): string {
  if (severity === 'high') return '高'
  if (severity === 'low') return '低'
  return '中'
}

export function shortDate(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getMonth() + 1}/${date.getDate()}`
}
