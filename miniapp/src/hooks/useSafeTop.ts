import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'

export function useSafeTop(): number {
  const [top, setTop] = useState(0)

  useEffect(() => {
    try {
      const info = Taro.getSystemInfoSync()
      setTop(Number(info.statusBarHeight) || 0)
    } catch {
      setTop(0)
    }
  }, [])

  return top
}
