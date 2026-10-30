import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { Button, Input, Text, Textarea, View } from '@tarojs/components'
import type { RiskRecord, RiskStatus } from '@/types'
import { riskTypeText, severityText } from '@/lib/format'
import { updateRisk } from '@/services/api'
import { Sheet } from './Sheet'

type Props = {
  visible: boolean
  risk: RiskRecord | null
  taskTitle?: string
  withTabBar?: boolean
  onClose: () => void
  onUpdated: (risk: RiskRecord) => void
}

const statusText = (status: RiskStatus) => {
  if (status === 'open') return '待处理'
  if (status === 'acknowledged') return '已知悉'
  return '已解决'
}

export function RiskSheet({ visible, risk, taskTitle, withTabBar, onClose, onUpdated }: Props) {
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!risk) return
    setTitle(risk.title)
    setDetail(risk.detail)
    setNote(risk.resolutionNote || '')
  }, [risk])

  if (!risk) return null

  const apply = async (status?: RiskStatus, closeAfter = false) => {
    setSaving(true)
    try {
      const result = await updateRisk(risk.id, {
        title: title.trim() || risk.title,
        detail: detail.trim(),
        note: note.trim() || null,
        ...(status ? { status } : {}),
      })
      onUpdated(result.risk)
      Taro.showToast({
        title:
          status === 'resolved'
            ? '风险已解决'
            : status === 'acknowledged'
              ? '已确认知悉'
              : status === 'open'
                ? '风险已重新打开'
                : '已保存',
        icon: 'none',
      })
      if (closeAfter) onClose()
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '更新失败',
        icon: 'none',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      visible={visible}
      title="风险详情"
      withTabBar={withTabBar}
      onClose={onClose}
      headerRight={
        <Text className="sheet-save" onClick={() => apply()}>
          保存
        </Text>
      }
      footer={
        <Button
          className="btn btn-primary"
          hoverClass="btn-hover"
          disabled={saving}
          onClick={() => apply()}
        >
          {saving ? '保存中…' : '保存修改'}
        </Button>
      }
    >
      <View className="field">
        <Text className="field-label">
          {riskTypeText(risk.type)} · 严重度 {severityText(risk.severity)} · {statusText(risk.status)}
        </Text>
        <Input
          className="field-input"
          value={title}
          onInput={(event) => setTitle(event.detail.value)}
        />
      </View>

      <View className="field">
        <Text className="field-label">说明</Text>
        <Textarea
          className="field-textarea"
          value={detail}
          maxlength={400}
          onInput={(event) => setDetail(event.detail.value)}
        />
      </View>

      {taskTitle ? (
        <View className="field">
          <Text className="field-label">关联任务</Text>
          <Text className="task-title">{taskTitle}</Text>
        </View>
      ) : null}

      <View className="risk-quote">
        <Text className="field-label">原文引用</Text>
        <Text className="quote">“{risk.sourceQuote}”</Text>
      </View>

      <View className="field">
        <Text className="field-label">处理说明（可选）</Text>
        <Textarea
          className="field-textarea"
          value={note}
          placeholder="写一句处理依据，便于之后回看"
          maxlength={400}
          onInput={(event) => setNote(event.detail.value)}
        />
      </View>

      <View className="risk-sheet-actions">
        {risk.status === 'resolved' ? (
          <Button
            className="btn btn-ghost"
            hoverClass="btn-hover"
            disabled={saving}
            onClick={() => apply('open', true)}
          >
            重新打开
          </Button>
        ) : (
          <>
            {risk.status === 'open' ? (
              <Button
                className="btn btn-ghost"
                hoverClass="btn-hover"
                disabled={saving}
                onClick={() => apply('acknowledged', true)}
              >
                确认知悉
              </Button>
            ) : null}
            <Button
              className="btn btn-primary"
              hoverClass="btn-hover"
              disabled={saving}
              onClick={() => apply('resolved', true)}
            >
              标记解决
            </Button>
          </>
        )}
      </View>
      <Text className="sheet-note">确认知悉不会自动关闭风险；解决后仍保留原文和处理记录。</Text>
    </Sheet>
  )
}
