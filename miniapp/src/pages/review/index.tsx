import { useState } from 'react'
import { Button, Switch, Text, View } from '@tarojs/components'
import Taro, { useLoad } from '@tarojs/taro'
import { MiniHeader } from '@/components/MiniHeader'
import { LoadingOverlay } from '@/components/LoadingOverlay'
import { TaskEditor } from '@/components/TaskEditor'
import {
  confirmExtraction,
  getExtraction,
  saveDraft,
} from '@/services/api'
import { setStoredProjectId } from '@/lib/storage'
import { dueText, ownerText, riskTypeText } from '@/lib/format'
import type {
  DraftRisk,
  DraftTask,
  ExtractionDetail,
  TaskEditValue,
} from '@/types'

function toEditValue(task: DraftTask): TaskEditValue {
  return {
    id: task.id,
    title: task.title,
    owner: task.owner,
    dueLabel: task.dueLabel,
    dueDate: task.dueDate,
    dateStatus: task.dateStatus,
    priority: task.priority,
    status: task.status,
    needsConfirmation: task.needsConfirmation,
    evidenceQuote: task.evidenceQuote,
    note: task.note,
  }
}

export default function ReviewPage() {
  const [extractionId, setExtractionId] = useState('')
  const [detail, setDetail] = useState<ExtractionDetail | null>(null)
  const [tasks, setTasks] = useState<DraftTask[]>([])
  const [risks, setRisks] = useState<DraftRisk[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState<TaskEditValue | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async (id: string) => {
    if (!id) {
      setLoading(false)
      setError('缺少审核记录。')
      return
    }
    setLoading(true)
    try {
      const result = await getExtraction(id)
      setDetail(result)
      setExtractionId(id)
      setTasks(result.extraction.payload.tasks)
      setRisks(result.extraction.payload.risks)
      setStoredProjectId(result.project.id)
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '读取审核记录失败。')
    } finally {
      setLoading(false)
    }
  }

  useLoad((options) => {
    load(String(options.extractionId || ''))
  })

  const readOnly = detail?.extraction.status === 'confirmed'
  const includedRisks = risks.filter((risk) => risk.include)
  const projectRisks = includedRisks.filter((risk) => !risk.taskRef)

  const persist = async (nextTasks: DraftTask[], nextRisks: DraftRisk[]) => {
    if (!extractionId || readOnly) return
    try {
      await saveDraft(extractionId, { tasks: nextTasks, risks: nextRisks })
    } catch {
      // The local draft remains usable; confirmation is the source of truth.
    }
  }

  const saveTask = async (value: TaskEditValue) => {
    const next = tasks.map((task) =>
      task.id === value.id
        ? {
            ...task,
            title: value.title,
            owner: value.owner,
            dueLabel: value.dueLabel,
            dueDate: value.dueDate,
            dateStatus: value.dateStatus,
            priority: value.priority,
            status: value.status,
            needsConfirmation: value.needsConfirmation,
            evidenceQuote: value.evidenceQuote,
            note: value.note,
          }
        : task,
    )
    setTasks(next)
    setEditing(null)
    await persist(next, risks)
  }

  const toggleRisk = (riskId: string, include: boolean) => {
    const next = risks.map((risk) =>
      risk.id === riskId ? { ...risk, include } : risk,
    )
    setRisks(next)
    persist(tasks, next)
  }

  const confirm = async () => {
    if (readOnly) {
      Taro.switchTab({ url: '/pages/tasks/index' })
      return
    }
    if (!extractionId || tasks.length === 0) {
      setError('至少保留一个任务。')
      return
    }
    const invalid = tasks.find(
      (task) => task.status === 'done' && !task.evidenceQuote?.trim(),
    )
    if (invalid) {
      setError(`「${invalid.title}」标记为完成，但缺少原文证据。`)
      return
    }
    setSaving(true)
    setError('')
    try {
      const result = await confirmExtraction(extractionId, { tasks, risks })
      setStoredProjectId(result.projectId)
      Taro.showToast({ title: '任务已创建', icon: 'success' })
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/tasks/index' })
      }, 350)
    } catch (confirmError) {
      setError(
        confirmError instanceof Error ? confirmError.message : '确认失败，请稍后重试。',
      )
    } finally {
      setSaving(false)
    }
  }


  return (
    <View className="fb-page fb-page--review">
      <MiniHeader
        back
        title="确认任务"
        right={
          detail ? (
            <Text className="mode-badge">
              {readOnly
                ? '已确认'
                : detail.extraction.mode === 'ai'
                  ? '真实 AI'
                  : '示例解析'}
            </Text>
          ) : null
        }
      />

      <View className="review-hero">
        <Text className="eyebrow">AI 整理结果</Text>
        <Text className="h1">核对一下，再开始。</Text>
        <View className="review-summary">
          <Text className="strong">{tasks.length} 个任务</Text>
          <View className="dot" />
          <Text>{includedRisks.length} 条提醒</Text>
          {detail ? <Text className="muted"> · {detail.project.name}</Text> : null}
        </View>
      </View>

      {error ? <View className="error pad">{error}</View> : null}

      <View className="review-list pad">
        {projectRisks.map((risk) => (
          <View className="project-risk" key={risk.id}>
            <View className="project-risk-head">
              <View className="risk-dot" />
              <Text>项目提醒 · {riskTypeText(risk.type)}</Text>
            </View>
            <Text className="project-risk-title">{risk.title}</Text>
            <Text className="risk-detail">{risk.detail}</Text>
          </View>
        ))}

        {tasks.map((task, index) => {
          const isExpanded = expanded === task.id
          return (
            <View className="review-task" key={task.id}>
              <View
                className="review-task-head"
                onClick={() => {
                  if (!readOnly) setEditing(toEditValue(task))
                }}
              >
                <Text className="num">{String(index + 1).padStart(2, '0')}</Text>
                <View className="review-task-body">
                  <Text className="task-title">{task.title}</Text>
                  <View className="task-meta">
                    <Text>{ownerText(task.owner)}</Text>
                    <Text className="sep">·</Text>
                    <Text>{dueText(task.dueLabel, task.dueDate)}</Text>
                  </View>
                </View>
                {!readOnly ? <Text className="chev">›</Text> : null}
              </View>

              <Text
                className="expand-link"
                onClick={() =>
                  setExpanded((current) => (current === task.id ? null : task.id))
                }
              >
                {isExpanded ? '收起来源与风险' : '查看来源与风险'}
              </Text>

              {isExpanded ? (
                <View className="expand-body">
                  <Text className="quote-speaker">
                    {task.speaker || '聊天原文'} · 逐字引用
                  </Text>
                  <Text className="quote">“{task.sourceQuote}”</Text>

                  {risks
                    .filter((risk) => risk.taskRef === task.id)
                    .map((risk) => (
                      <View className="risk-item" key={risk.id}>
                        <View className="risk-copy">
                          <Text className="risk-label">{riskTypeText(risk.type)}</Text>
                          <Text className="risk-title">{risk.title}</Text>
                          <Text className="risk-detail">{risk.detail}</Text>
                        </View>
                        {!readOnly ? (
                          <Switch
                            checked={risk.include}
                            color="#C9F24E"
                            onChange={(event) =>
                              toggleRisk(risk.id, event.detail.value)
                            }
                          />
                        ) : null}
                      </View>
                    ))}
                </View>
              ) : null}
            </View>
          )
        })}
      </View>

      <View className="bottom-bar">
        <View className="bottom-meta">
          <Text>
            <Text className="strong">{tasks.length}</Text> 个任务
          </Text>
          <Text>{includedRisks.length} 条提醒会保留</Text>
        </View>
        <Button
          className={`btn ${readOnly ? 'btn-ghost' : 'btn-primary'} bottom-btn`}
          hoverClass="btn-hover"
          disabled={saving}
          onClick={confirm}
        >
          {readOnly ? '查看任务' : saving ? '正在创建…' : '确认并创建任务'}
        </Button>
      </View>

      <LoadingOverlay
        visible={loading}
        title="正在读取整理结果…"
        sub="准备任务和提醒"
      />

      <TaskEditor
        visible={Boolean(editing)}
        task={editing}
        mode="review"
        onClose={() => setEditing(null)}
        onSave={saveTask}
      />
    </View>
  )
}
