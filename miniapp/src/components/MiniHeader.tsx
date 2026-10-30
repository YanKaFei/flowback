import { ReactNode } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useSafeTop } from '@/hooks/useSafeTop'

type Props = {
  brand?: boolean
  back?: boolean
  title?: string
  right?: ReactNode
}

export function MiniHeader({ brand, back, title, right }: Props) {
  const top = useSafeTop()
  const isH5 = process.env.TARO_ENV === 'h5'
  const paddingTop = isH5 ? 8 : Math.max(top, 20) + 44

  const goBack = () => {
    Taro.navigateBack({ delta: 1 }).catch(() => {
      Taro.switchTab({ url: '/pages/import/index' })
    })
  }

  return (
    <View className="app-header" style={{ paddingTop: `${paddingTop}px` }}>
      <View className="header-row">
        <View className="header-left">
          {back ? (
            <View className="header-back" onClick={goBack}>
              <Text>‹</Text>
            </View>
          ) : null}
          {brand ? (
            <View className="brand">
              <View className="logo-mark">
                <Text>F</Text>
              </View>
              <Text className="brand-name">FlowBack</Text>
            </View>
          ) : null}
          {title ? <Text className="header-title">{title}</Text> : null}
        </View>
        {right ? <View className="header-right">{right}</View> : null}
      </View>
    </View>
  )
}
