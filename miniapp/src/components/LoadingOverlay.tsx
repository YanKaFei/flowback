import { Text, View } from '@tarojs/components'

type Props = {
  visible: boolean
  title?: string
  sub?: string
}

export function LoadingOverlay({
  visible,
  title = '正在整理聊天…',
  sub = '识别任务、负责人和截止时间',
}: Props) {
  if (!visible) return null

  return (
    <View className="loading-overlay" catchMove>
      <View className="loading-mark">
        <Text>F</Text>
      </View>
      <Text className="loading-title">{title}</Text>
      <Text className="loading-sub">{sub}</Text>
      <View className="loading-dots">
        <Text className="dot" />
        <Text className="dot" />
        <Text className="dot" />
      </View>
    </View>
  )
}
