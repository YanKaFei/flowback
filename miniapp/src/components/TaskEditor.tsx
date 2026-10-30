import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { Button, Input, Picker, Text, Textarea, View } from '@tarojs/components'
import type { Priority, TaskEditValue, TaskStatus } from '@/types'
import { Sheet } from './Sheet'

type Props = {
  visible: boolean
  task: TaskEditValue | null
  mode: 'review' | 'task'
  withTabBar?: boolean
  onClose: () => void
  onSave: (value: TaskEditValue) => void | Promise<void>
}

const EMPTY: TaskEditValue = {
  id: '',
  title: '',
  owner: null,
  dueLabel: null,
  dueDate: null,
  dateStatus: 'unknown',
  priority: 'medium',
  status: 'todo',
  needsConfirmation: false,
  evidenceQuote: null,
  note: null,
}

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
]

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: '待处理' },
  { value: 'doing', label: '进行中' },
  { value: 'done', label: '已完成' },
]

export function TaskEditor({ visible, task, mode, withTabBar, onClose, onSave }: Props) {
  const [form, setForm] = useState<TaskEditValue>(EMPTY)

  useEffect(() => {
    if (!task) return
    setForm({
      ...task,
      owner: task.owner ?? null,
      dueLabel: task.dueLabel ?? null,
      dueDate: task.dueDate ?? null,
      evidenceQuote: task.evidenceQuote ?? null,
      note: task.note ?? null,
    })
  }, [task])

  const set = <K extends keyof TaskEditValue>(key: K, value: TaskEditValue[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const save = async () => {
    if (!form.title.trim()) {
      Taro.showToast({ title: '任务名称不能为空', icon: 'none' })
      return
    }
    if (mode === 'review' && form.status === 'done' && !form.evidenceQuote?.trim()) {
      Taro.showToast({ title: '完成需要原文证据', icon: 'none' })
      return
    }
    await onSave({
      ...form,
      title: form.title.trim(),
      owner: form.owner?.trim() || null,
      dueLabel: form.dueLabel?.trim() || null,
      dueDate: form.dueDate || null,
      evidenceQuote: form.evidenceQuote?.trim() || null,
      note: form.note?.trim() || null,
    })
  }

  return (
    <Sheet
      visible={visible}
      title="编辑任务"
      withTabBar={withTabBar}
      onClose={onClose}
      headerRight={
        <Text className="sheet-save" onClick={save}>
          保存
        </Text>
      }
      footer={
        <Button className="btn btn-primary" hoverClass="btn-hover" onClick={save}>
          保存
        </Button>
      }
    >
      <View className="field">
        <Text className="field-label">任务名称</Text>
        <Input
          className="field-input"
          value={form.title}
          placeholder="例如：提交海报初稿"
          onInput={(event) => set('title', event.detail.value)}
        />
      </View>

      <View className="field-row">
        <View className="field-col">
          <View className="field">
            <Text className="field-label">负责人</Text>
            <Input
              className="field-input"
              value={form.owner || ''}
              placeholder="未指派"
              onInput={(event) => set('owner', event.detail.value)}
            />
          </View>
        </View>
        <View className="field-col">
          <View className="field">
            <Text className="field-label">截止（原文）</Text>
            <Input
              className="field-input"
              value={form.dueLabel || ''}
              placeholder="例如：周五"
              onInput={(event) => set('dueLabel', event.detail.value)}
            />
          </View>
        </View>
      </View>

      <View className="field">
        <Text className="field-label">具体日期（可选）</Text>
        <Picker
          mode="date"
          value={form.dueDate || ''}
          onChange={(event) => {
            set('dueDate', event.detail.value || null)
            set('dateStatus', event.detail.value ? 'confirmed' : 'unknown')
          }}
        >
          <View className="picker">
            <Text className={form.dueDate ? '' : 'picker-placeholder'}>
              {form.dueDate || '选择日期'}
            </Text>
            <Text className="tiny">{form.dueDate ? '清除' : ''}</Text>
          </View>
        </Picker>
        {form.dueDate ? (
          <Text
            className="tiny"
            onClick={() => {
              set('dueDate', null)
              set('dateStatus', 'unknown')
            }}
          >
            清除日期
          </Text>
        ) : null}
      </View>

      <View className="field">
        <Text className="field-label">优先级</Text>
        <View className="chips">
          {PRIORITY_OPTIONS.map((item) => (
            <Text
              key={item.value}
              className={`chip-option ${form.priority === item.value ? 'on' : ''}`}
              onClick={() => set('priority', item.value)}
            >
              {item.label}
            </Text>
          ))}
        </View>
      </View>

      <View className="field">
        <Text className="field-label">状态</Text>
        <View className="chips">
          {STATUS_OPTIONS.map((item) => (
            <Text
              key={item.value}
              className={`chip-option ${form.status === item.value ? 'on' : ''}`}
              onClick={() => set('status', item.value)}
            >
              {item.label}
            </Text>
          ))}
        </View>
      </View>

      {form.status === 'done' ? (
        <View className="field">
          <Text className="field-label">完成证据（原文）</Text>
          <Textarea
            className="field-textarea"
            value={form.evidenceQuote || ''}
            placeholder="例如：海报已经发到群里了"
            maxlength={300}
            onInput={(event) => set('evidenceQuote', event.detail.value)}
          />
          <Text className="tiny">“收到 / 好的”不算完成证据。</Text>
        </View>
      ) : null}

      <View className="switch-row">
        <View>
          <Text className="switch-label">字段待人工确认</Text>
          <Text className="switch-hint">确认前保留“需核对”标记</Text>
        </View>
        <View
          className={`switch ${form.needsConfirmation ? 'on' : ''}`}
          onClick={() => set('needsConfirmation', !form.needsConfirmation)}
        >
          <View className="switch-knob" />
        </View>
      </View>

      <View className="field">
        <Text className="field-label">备注（可选）</Text>
        <Textarea
          className="field-textarea"
          value={form.note || ''}
          placeholder="补充上下文"
          maxlength={400}
          onInput={(event) => set('note', event.detail.value)}
        />
      </View>

      <Text className="sheet-note">
        {mode === 'review'
          ? '保存后会先更新草稿；只有点击底部“确认并创建任务”才会写入任务库。'
          : '保存后立即更新任务清单。'}
      </Text>
    </Sheet>
  )
}
