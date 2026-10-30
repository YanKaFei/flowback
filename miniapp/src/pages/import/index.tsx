import { useState } from 'react'
import { Image, ScrollView, Text, Textarea, View, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { MiniHeader } from '@/components/MiniHeader'
import { LoadingOverlay } from '@/components/LoadingOverlay'
import { analyzeChat, getHealth, listProjects } from '@/services/api'
import { pickChatImages, MAX_IMAGES } from '@/lib/image'
import { setStoredProjectId } from '@/lib/storage'
import type { HealthResult, ProjectSummary, SelectedImage } from '@/types'

const MAX_TOTAL_BYTES = 6 * 1024 * 1024

export default function ImportPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [health, setHealth] = useState<HealthResult | null>(null)
  const [healthError, setHealthError] = useState(false)
  const [images, setImages] = useState<SelectedImage[]>([])
  const [text, setText] = useState('')
  const [showText, setShowText] = useState(false)
  const [loading, setLoading] = useState(false)
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState('')

  const refresh = async () => {
    try {
      const healthResult = await getHealth()
      setHealth(healthResult)
      setHealthError(false)
    } catch {
      setHealthError(true)
    }
    try {
      const projectResult = await listProjects()
      setProjects(projectResult.projects.slice(0, 3))
    } catch (projectError) {
      setProjects([])
      setError(
        projectError instanceof Error
          ? projectError.message
          : '无法建立安全会话，请检查服务端配置。',
      )
    }
  }

  useDidShow(() => {
    refresh()
  })

  const ensurePrivacyConsent = async (): Promise<boolean> => {
    // H5 preview has no native modal gesture chain; the inline notice remains.
    // WeChat native shows the explicit pre-upload confirmation.
    if (process.env.TARO_ENV === 'h5') return true
    try {
      if (Taro.getStorageSync('flowback.privacyAccepted') === '1') return true
    } catch {
      // Ask again if storage is unavailable.
    }
    const result = await Taro.showModal({
      title: '截图仅用于整理',
      content:
        '截图会发送到你的 FlowBack 服务并保存在本地，用于生成任务草稿；不会读取微信群聊。删除项目会同时删除截图。',
      confirmText: '继续选择',
      cancelText: '取消',
    })
    if (!result.confirm) return false
    try {
      Taro.setStorageSync('flowback.privacyAccepted', '1')
    } catch {
      // Consent still applies to this action.
    }
    return true
  }

  const addImages = async () => {
    if (picking) return
    if (!(await ensurePrivacyConsent())) return
    if (images.length >= MAX_IMAGES) {
      Taro.showToast({ title: `最多 ${MAX_IMAGES} 张截图`, icon: 'none' })
      return
    }
    setPicking(true)
    setError('')
    try {
      const picked = await pickChatImages(MAX_IMAGES - images.length)
      const totalBytes = [...images, ...picked].reduce(
        (sum, image) => sum + image.bytes,
        0,
      )
      if (totalBytes > MAX_TOTAL_BYTES) {
        setError('截图总大小超过 6MB，请减少数量或压缩后重试。')
        return
      }
      setImages((current) => [...current, ...picked].slice(0, MAX_IMAGES))
    } catch (pickError) {
      if (pickError instanceof Error && !/取消/.test(pickError.message)) {
        setError(pickError.message)
      }
    } finally {
      setPicking(false)
    }
  }

  const removeImage = (index: number) => {
    setImages((current) => current.filter((_, currentIndex) => currentIndex !== index))
    setError('')
  }

  const canAnalyze = Boolean(text.trim() || images.length > 0)

  const analyze = async () => {
    if (!canAnalyze || loading) {
      if (!canAnalyze) setError('先上传一张聊天截图，或粘贴聊天文字。')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await analyzeChat({
        text: text.trim(),
        images: images.map((image) => ({
          name: image.name,
          mime: image.mime,
          dataUrl: image.dataUrl,
        })),
      })
      setStoredProjectId(result.projectId)
      await Taro.navigateTo({
        url: `/pages/review/index?extractionId=${result.extractionId}&projectId=${result.projectId}`,
      })
    } catch (analysisError) {
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : '整理失败，请稍后重试。',
      )
    } finally {
      setLoading(false)
    }
  }

  const openProject = (project: ProjectSummary) => {
    setStoredProjectId(project.id)
    Taro.switchTab({ url: '/pages/tasks/index' })
  }

  const statusLabel = healthError
    ? '服务未连接'
    : health
      ? health.ai.configured
        ? 'AI 已连接'
        : 'AI 未配置'
      : '连接中'

  const statusClass = healthError ? 'warn' : health?.ai.configured ? 'on' : ''

  return (
    <View className="fb-page fb-page--tab">
      <MiniHeader
        brand
        right={
          <View className="status">
            <View className={`status-dot ${statusClass}`} />
            <Text>{statusLabel}</Text>
          </View>
        }
      />

      <View className="hero">
        <Text className="eyebrow">CHAT → TASK</Text>
        <Text className="h1">
          把聊天，
          <Text className="accent">变成任务</Text>。
        </Text>
        <Text className="sub">
          上传一张聊天截图，AI 先整理。你确认之后，任务才会进入清单。
        </Text>

        <View className="upload" onClick={addImages}>
          <View className="upload-plus">
            <Text>＋</Text>
          </View>
          <View className="upload-copy">
            <Text className="upload-title">
              {picking ? '正在读取截图…' : images.length ? '继续添加截图' : '上传聊天截图'}
            </Text>
            <Text className="upload-hint">
              从相册选择 · 最多 {MAX_IMAGES} 张 · 不会自动读取群聊
            </Text>
          </View>
        </View>
        <Text className="privacy-note">
          截图仅用于本次整理，保存在你的 FlowBack 服务；删除项目会同时删除截图。
        </Text>

        {images.length > 0 ? (
          <ScrollView scrollX className="thumbs">
            {images.map((image, index) => (
              <View className="thumb-wrap" key={`${image.path}-${index}`}>
                <Image className="thumb" src={image.path} mode="aspectFill" />
                <View
                  className="thumb-del"
                  onClick={(event) => {
                    event.stopPropagation()
                    removeImage(index)
                  }}
                >
                  <Text>×</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <View className="form-area">
          {showText ? (
            <Textarea
              className="textarea"
              value={text}
              placeholder="把聊天记录粘贴到这里，保留说话人和时间会更准。"
              maxlength={20000}
              autoHeight
              onInput={(event) => {
                setText(event.detail.value)
                setError('')
              }}
            />
          ) : null}
          <View className="link-row">
            <Text className="link" onClick={() => setShowText((current) => !current)}>
              {showText ? '收起文字输入' : '粘贴聊天文字'}
            </Text>
            {showText && text ? (
              <Text className="tiny">{text.length} 字</Text>
            ) : null}
          </View>
        </View>

        {error ? <View className="error">{error}</View> : null}

        <Button
          className={`btn btn-primary analyze-btn ${canAnalyze ? '' : 'disabled'}`}
          hoverClass={canAnalyze ? 'btn-hover' : 'none'}
          disabled={!canAnalyze || loading}
          onClick={analyze}
        >
          {loading ? '正在整理…' : '开始整理'}
        </Button>
      </View>

      <View className="section pad">
        <View className="section-head">
          <Text className="section-title">最近项目</Text>
          {projects.length > 0 ? (
            <Text className="section-count">{projects.length} 个</Text>
          ) : null}
        </View>

        {projects.length > 0 ? (
          <View className="recent-list">
            {projects.map((project) => (
              <View
                className="recent-row"
                key={project.id}
                onClick={() => openProject(project)}
              >
                <View className="recent-main">
                  <Text className="recent-name">{project.name}</Text>
                  <Text className="recent-meta">
                    {project.taskCount} 个任务 · {project.doneCount} 已完成
                    {project.openRiskCount > 0
                      ? ` · ${project.openRiskCount} 个提醒`
                      : ''}
                  </Text>
                </View>
                <Text className="recent-arrow">›</Text>
              </View>
            ))}
          </View>
        ) : (
          <View className="empty">
            <Text className="empty-title">还没有项目</Text>
            <Text className="empty-text">
              先整理一段聊天，确认后的任务会出现在「任务」里。
            </Text>
          </View>
        )}
      </View>

      <LoadingOverlay visible={loading} />
    </View>
  )
}
