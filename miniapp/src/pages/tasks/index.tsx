import { useState } from 'react'
import { Button, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useLoad } from '@tarojs/taro'
import { MiniHeader } from '@/components/MiniHeader'
import { LoadingOverlay } from '@/components/LoadingOverlay'
import { TaskEditor } from '@/components/TaskEditor'
import { RiskSheet } from '@/components/RiskSheet'
import {
  deleteProject,
  getProjectBundle,
  listProjects,
  updateTask,
} from '@/services/api'
import { clearStoredProjectId, getStoredProjectId, setStoredProjectId } from '@/lib/storage'
import { dueText, ownerText, riskTypeText, shortDate } from '@/lib/format'
import type {
  ProjectBundle,
  ProjectSummary,
  RiskRecord,
  TaskEditValue,
  TaskRecord,
} from '@/types'

function toEditValue(task: TaskRecord): TaskEditValue {
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

export default function TasksPage() {
  const [routeProjectId, setRouteProjectId] = useState('')
  const [bundle, setBundle] = useState<ProjectBundle | null>(null)
  const [recent, setRecent] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedSource, setExpandedSource] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<TaskEditValue | null>(null)
  const [editingRisk, setEditingRisk] = useState<RiskRecord | null>(null)
  const [justDone, setJustDone] = useState<string | null>(null)

  const loadProject = async (id: string) => {
    if (!id) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const result = await getProjectBundle(id)
      setBundle(result)
      setStoredProjectId(result.project.id)
      setError('')
    } catch (loadError) {
      setBundle(null)
      setError(loadError instanceof Error ? loadError.message : '读取任务失败。')
    } finally {
      setLoading(false)
    }
  }

  const loadRecent = async () => {
    setLoading(true)
    try {
      const result = await listProjects()
      setRecent(result.projects.slice(0, 4))
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '读取项目失败。')
    } finally {
      setLoading(false)
    }
  }

  useLoad((options) => {
    const id = String(options.projectId || getStoredProjectId() || '')
    setRouteProjectId(id)
    if (id) loadProject(id)
    else loadRecent()
  })

  useDidShow(() => {
    const id = routeProjectId || getStoredProjectId()
    if (id) loadProject(id)
    else loadRecent()
  })

  const tasks = bundle?.tasks || []
  const risks = bundle?.risks || []
  const pending = tasks.filter((task) => task.status !== 'done')
  const done = tasks.filter((task) => task.status === 'done')
  const projectRisks = risks.filter(
    (risk) => !risk.taskId && risk.status !== 'resolved',
  )
  const resolvedRisks = risks.filter((risk) => risk.status === 'resolved')
  const doneCount = bundle?.project.doneCount ?? done.length
  const total = bundle?.project.taskCount ?? tasks.length
  const progress = total > 0 ? Math.min(100, Math.round((doneCount / total) * 100)) : 0

  const risksForTask = (taskId: string) =>
    risks.filter((risk) => risk.taskId === taskId && risk.status !== 'resolved')

  const toggleDone = async (task: TaskRecord) => {
    const next = task.status === 'done' ? 'todo' : 'done'
    try {
      const result = await updateTask(task.id, { status: next })
      setBundle((current) => {
        if (!current) return current
        const nextTasks = current.tasks.map((item) =>
          item.id === result.task.id ? result.task : item,
        )
        return {
          ...current,
          tasks: nextTasks,
          project: {
            ...current.project,
            doneCount: nextTasks.filter((item) => item.status === 'done').length,
          },
        }
      })
      if (next === 'done') {
        setJustDone(task.id)
        setTimeout(() => setJustDone(null), 260)
        try {
          Promise.resolve(Taro.vibrateShort({ type: 'light' })).catch(() => {})
        } catch {
          // Vibration is an enhancement; H5 and some devices do not support it.
        }
      }
    } catch (updateError) {
      Taro.showToast({
        title: updateError instanceof Error ? updateError.message : '更新失败',
        icon: 'none',
      })
    }
  }

  const saveTask = async (value: TaskEditValue) => {
    try {
      const result = await updateTask(value.id, {
        title: value.title,
        owner: value.owner,
        dueLabel: value.dueLabel,
        dueDate: value.dueDate,
        dateStatus: value.dateStatus,
        priority: value.priority,
        status: value.status,
        note: value.note,
      })
      setBundle((current) => {
        if (!current) return current
        const nextTasks = current.tasks.map((item) =>
          item.id === result.task.id ? result.task : item,
        )
        return {
          ...current,
          tasks: nextTasks,
          project: {
            ...current.project,
            doneCount: nextTasks.filter((item) => item.status === 'done').length,
          },
        }
      })
      setEditingTask(null)
      Taro.showToast({ title: '已保存', icon: 'none' })
    } catch (saveError) {
      Taro.showToast({
        title: saveError instanceof Error ? saveError.message : '保存失败',
        icon: 'none',
      })
    }
  }

  const updateRiskInBundle = (nextRisk: RiskRecord) => {
    setBundle((current) =>
      current
        ? {
            ...current,
            risks: current.risks.map((risk) =>
              risk.id === nextRisk.id ? nextRisk : risk,
            ),
          }
        : current,
    )
    setEditingRisk(nextRisk)
  }

  const openArchive = (task: TaskRecord) => {
    if (!task.extractionId) return
    Taro.navigateTo({
      url: `/pages/review/index?extractionId=${task.extractionId}&projectId=${task.projectId}`,
    })
  }

  const openRecent = (project: ProjectSummary) => {
    setStoredProjectId(project.id)
    setRouteProjectId(project.id)
    loadProject(project.id)
  }

  const removeProject = async () => {
    if (!bundle) return
    const confirmed = await Taro.showModal({
      title: '删除这个项目？',
      content: '任务、审核记录、风险和来源截图都会删除，无法恢复。',
      confirmText: '删除',
      confirmColor: '#B14E26',
      cancelText: '取消',
    })
    if (!confirmed.confirm) return
    try {
      await deleteProject(bundle.project.id)
      clearStoredProjectId()
      setBundle(null)
      setRouteProjectId('')
      Taro.showToast({ title: '项目已删除', icon: 'none' })
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/import/index' })
      }, 300)
    } catch (deleteError) {
      Taro.showToast({
        title: deleteError instanceof Error ? deleteError.message : '删除失败',
        icon: 'none',
      })
    }
  }

  const taskRiskLabel = (risk: RiskRecord) => riskTypeText(risk.type)

  return (
    <View className="fb-page fb-page--tab">
      <MiniHeader
        brand
        right={
          <Text className="link" onClick={() => Taro.switchTab({ url: '/pages/import/index' })}>
            导入
          </Text>
        }
      />

      {bundle ? (
        <>
          <View className="project-hero">
            <Text className="eyebrow">任务</Text>
            <Text className="project-title">{bundle.project.name}</Text>
            <View className="project-meta">
              <Text>
                {doneCount} / {total} 已完成
              </Text>
              {projectRisks.length > 0 ? (
                <>
                  <Text className="sep">·</Text>
                  <Text>{projectRisks.length} 个项目提醒</Text>
                </>
              ) : null}
            </View>
            <View className="progress-track">
              <View className="progress-fill" style={{ width: `${progress}%` }} />
            </View>
          </View>

          {projectRisks.map((risk) => (
            <View className="pad" key={risk.id}>
              <View
                className="project-risk-row"
                onClick={() => setEditingRisk(risk)}
              >
                <View className="risk-dot" />
                <View className="project-risk-copy">
                  <Text className="project-risk-label">
                    项目提醒 · {riskTypeText(risk.type)}
                  </Text>
                  <Text className="project-risk-name">{risk.title}</Text>
                </View>
                <Text className="chev">›</Text>
              </View>
            </View>
          ))}

          <View className="pad task-section">
            <View className="section-head">
              <Text className="section-title">待完成</Text>
              <Text className="section-count">{pending.length}</Text>
            </View>
            {pending.length === 0 ? (
              <View className="empty">
                <Text className="empty-title">都完成了</Text>
                <Text className="empty-text">新的任务会出现在这里。</Text>
              </View>
            ) : (
              pending.map((task) => {
                const linkedRisks = risksForTask(task.id)
                const sourceOpen = expandedSource === task.id
                return (
                  <View
                    className={`task-row ${justDone === task.id ? 'just-done' : ''}`}
                    key={task.id}
                  >
                    <View className="task-row-main">
                      <View
                        className="check-hit"
                        onClick={(event) => {
                          event.stopPropagation()
                          toggleDone(task)
                        }}
                      >
                        <View className="check">
                          <Text>✓</Text>
                        </View>
                      </View>
                      <View
                        className="task-copy"
                        onClick={() => setEditingTask(toEditValue(task))}
                      >
                        <Text className="task-title">{task.title}</Text>
                        <View className="task-meta">
                          <Text>{ownerText(task.owner)}</Text>
                          <Text className="sep">·</Text>
                          <Text>{dueText(task.dueLabel, task.dueDate)}</Text>
                          {task.status === 'doing' ? (
                            <Text className="tag">进行中</Text>
                          ) : null}
                        </View>
                        {linkedRisks.length > 0 ? (
                          <View className="task-risks">
                            <View className="risk-dot" />
                            {linkedRisks.map((risk) => (
                              <Text
                                className="risk-hint"
                                key={risk.id}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setEditingRisk(risk)
                                }}
                              >
                                {taskRiskLabel(risk)}
                              </Text>
                            ))}
                          </View>
                        ) : null}
                      </View>
                      <Text
                        className="chev"
                        onClick={() => setEditingTask(toEditValue(task))}
                      >
                        ›
                      </Text>
                    </View>

                    {sourceOpen ? (
                      <View className="source-expand">
                        <Text className="source-meta">
                          {task.speaker || '聊天原文'} · {shortDate(task.createdAt)}
                        </Text>
                        <Text className="source-quote">“{task.sourceQuote}”</Text>
                      </View>
                    ) : null}

                    <View className="task-actions">
                      <Text
                        className="link"
                        onClick={() =>
                          setExpandedSource((current) =>
                            current === task.id ? null : task.id,
                          )
                        }
                      >
                        {sourceOpen ? '收起来源' : '查看来源'}
                      </Text>
                      <Text
                        className="link"
                        onClick={() => setEditingTask(toEditValue(task))}
                      >
                        编辑
                      </Text>
                      {task.extractionId ? (
                        <Text className="link" onClick={() => openArchive(task)}>
                          审核存档
                        </Text>
                      ) : null}
                    </View>
                  </View>
                )
              })
            )}
          </View>

          {resolvedRisks.length > 0 ? (
            <View className="pad done-section">
              <View className="section-head">
                <Text className="section-title">已解决的提醒</Text>
                <Text className="section-count">{resolvedRisks.length}</Text>
              </View>
              {resolvedRisks.map((risk) => (
                <View
                  className="resolved-risk"
                  key={risk.id}
                  onClick={() => setEditingRisk(risk)}
                >
                  <View className="risk-dot resolved-dot" />
                  <View className="project-risk-copy">
                    <Text className="project-risk-label">
                      已解决 · {riskTypeText(risk.type)}
                    </Text>
                    <Text className="project-risk-name">{risk.title}</Text>
                  </View>
                  <Text className="chev">›</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View className="pad done-section">
            <View className="section-head">
              <Text className="section-title">已完成</Text>
              <Text className="section-count">{done.length}</Text>
            </View>
            {done.length === 0 ? (
              <View className="empty">
                <Text className="empty-text">完成的任务会归到这里。</Text>
              </View>
            ) : (
              done.map((task) => {
                const sourceOpen = expandedSource === task.id
                return (
                  <View className={`task-row is-done ${justDone === task.id ? 'just-done' : ''}`} key={task.id}>
                    <View className="task-row-main">
                      <View
                        className="check-hit"
                        onClick={(event) => {
                          event.stopPropagation()
                          toggleDone(task)
                        }}
                      >
                        <View className={`check on ${justDone === task.id ? 'pop' : ''}`}>
                          <Text>✓</Text>
                        </View>
                      </View>
                      <View
                        className="task-copy"
                        onClick={() => setEditingTask(toEditValue(task))}
                      >
                        <Text className="task-title">{task.title}</Text>
                        <View className="task-meta">
                          <Text>{ownerText(task.owner)}</Text>
                          <Text className="sep">·</Text>
                          <Text>{dueText(task.dueLabel, task.dueDate)}</Text>
                        </View>
                        {risksForTask(task.id).length > 0 ? (
                          <View className="task-risks">
                            <View className="risk-dot" />
                            {risksForTask(task.id).map((risk) => (
                              <Text
                                className="risk-hint"
                                key={risk.id}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setEditingRisk(risk)
                                }}
                              >
                                {taskRiskLabel(risk)}
                              </Text>
                            ))}
                          </View>
                        ) : null}
                      </View>
                      <Text className="chev" onClick={() => setEditingTask(toEditValue(task))}>
                        ›
                      </Text>
                    </View>
                    {sourceOpen ? (
                      <View className="source-expand">
                        <Text className="source-meta">
                          {task.speaker || '聊天原文'} · {shortDate(task.createdAt)}
                        </Text>
                        <Text className="source-quote">“{task.sourceQuote}”</Text>
                      </View>
                    ) : null}
                    <View className="task-actions">
                      <Text
                        className="link"
                        onClick={() =>
                          setExpandedSource((current) =>
                            current === task.id ? null : task.id,
                          )
                        }
                      >
                        {sourceOpen ? '收起来源' : '查看来源'}
                      </Text>
                      <Text
                        className="link"
                        onClick={() => setEditingTask(toEditValue(task))}
                      >
                        编辑
                      </Text>
                      {task.extractionId ? (
                        <Text className="link" onClick={() => openArchive(task)}>
                          审核存档
                        </Text>
                      ) : null}
                    </View>
                  </View>
                )
              })
            )}
          </View>

          <View className="pad delete-row">
            <Text className="delete-link" onClick={removeProject}>
              删除此项目
            </Text>
            <Text className="delete-hint">任务、提醒和截图会一起删除</Text>
          </View>
        </>
      ) : (
        <View className="pad">
          <View className="project-hero">
            <Text className="eyebrow">任务</Text>
            <Text className="project-title">还没有任务</Text>
            <Text className="sub">从一段聊天开始，确认后就会出现在这里。</Text>
          </View>
          <Button
            className="btn btn-primary empty-action"
            hoverClass="btn-hover"
            onClick={() => Taro.switchTab({ url: '/pages/import/index' })}
          >
            去导入
          </Button>

          {recent.length > 0 ? (
            <View className="section">
              <View className="section-head">
                <Text className="section-title">最近项目</Text>
              </View>
              {recent.map((project) => (
                <View
                  className="recent-row"
                  key={project.id}
                  onClick={() => openRecent(project)}
                >
                  <View className="recent-main">
                    <Text className="recent-name">{project.name}</Text>
                    <Text className="recent-meta">
                      {project.taskCount} 个任务 · {project.doneCount} 已完成
                    </Text>
                  </View>
                  <Text className="recent-arrow">›</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      )}

      {error ? (
        <View className="pad">
          <View className="error">{error}</View>
        </View>
      ) : null}

      <LoadingOverlay visible={loading} title="正在读取任务…" sub="同步最新状态" />

      <TaskEditor
        visible={Boolean(editingTask)}
        task={editingTask}
        mode="task"
        withTabBar
        onClose={() => setEditingTask(null)}
        onSave={saveTask}
      />

      <RiskSheet
        visible={Boolean(editingRisk)}
        risk={editingRisk}
        taskTitle={
          editingRisk?.taskId
            ? tasks.find((task) => task.id === editingRisk.taskId)?.title
            : undefined
        }
        withTabBar
        onClose={() => setEditingRisk(null)}
        onUpdated={updateRiskInBundle}
      />
    </View>
  )
}
