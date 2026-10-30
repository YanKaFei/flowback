import Taro from '@tarojs/taro'

const PROJECT_KEY = 'flowback.projectId'

export function getStoredProjectId(): string {
  try {
    return String(Taro.getStorageSync(PROJECT_KEY) || '')
  } catch {
    return ''
  }
}

export function setStoredProjectId(id: string) {
  try {
    Taro.setStorageSync(PROJECT_KEY, id)
  } catch {
    // Storage is a convenience only; the page still works with a route param.
  }
}

export function clearStoredProjectId() {
  try {
    Taro.removeStorageSync(PROJECT_KEY)
  } catch {
    // Nothing else to clean up.
  }
}
