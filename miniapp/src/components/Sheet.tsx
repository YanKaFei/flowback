import { ReactNode } from 'react'
import { ScrollView, Text, View } from '@tarojs/components'

type Props = {
  visible: boolean
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  headerRight?: ReactNode
  withTabBar?: boolean
}

export function Sheet({
  visible,
  title,
  onClose,
  children,
  footer,
  headerRight,
  withTabBar,
}: Props) {
  if (!visible) return null

  return (
    <View
      className={`sheet-root ${withTabBar ? 'sheet-root--tab' : ''}`}
      catchMove
      onClick={onClose}
    >
      <View className="sheet-panel" catchMove onClick={(event) => event.stopPropagation()}>
        <View className="sheet-head">
          <Text className="sheet-title">{title}</Text>
          <View className="sheet-head-actions">
            {headerRight}
            <Text className="sheet-close" onClick={onClose}>
              关闭
            </Text>
          </View>
        </View>
        <ScrollView scrollY className="sheet-body">
          {children}
        </ScrollView>
        {footer ? <View className="sheet-footer">{footer}</View> : null}
      </View>
    </View>
  )
}
