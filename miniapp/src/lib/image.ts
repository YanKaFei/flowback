import Taro from '@tarojs/taro'
import type { SelectedImage } from '@/types'

export const MAX_IMAGES = 4
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export class ImagePickError extends Error {
  cancelled: boolean

  constructor(message: string, cancelled = false) {
    super(message)
    this.name = 'ImagePickError'
    this.cancelled = cancelled
  }
}

function mimeFromPath(path: string): string {
  const clean = path.split('?')[0].toLowerCase()
  if (clean.endsWith('.png')) return 'image/png'
  if (clean.endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}

function nameFromPath(path: string): string {
  const clean = path.split('?')[0]
  const name = clean.split('/').pop() || '聊天截图'
  return name.length > 60 ? `${name.slice(0, 56)}.jpg` : name
}

function readMiniFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const fs = Taro.getFileSystemManager()
    fs.readFile({
      filePath: path,
      encoding: 'base64',
      success: (res) => resolve(String(res.data)),
      fail: (error) => reject(new Error(error.errMsg || '读取图片失败')),
    })
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(blob)
  })
}

async function readH5File(path: string): Promise<{ dataUrl: string; bytes: number }> {
  const response = await fetch(path)
  if (!response.ok) throw new Error('读取图片失败')
  const blob = await response.blob()
  const dataUrl = await blobToDataUrl(blob)
  return { dataUrl, bytes: blob.size }
}

async function readImage(path: string): Promise<SelectedImage> {
  let previewPath = path
  let mime = mimeFromPath(path)

  if (process.env.TARO_ENV !== 'h5') {
    try {
      const compressed = await Taro.compressImage({ src: path, quality: 80 })
      previewPath = compressed.tempFilePath
      mime = mimeFromPath(previewPath)
    } catch {
      previewPath = path
    }
    const base64 = await readMiniFile(previewPath)
    const bytes = Math.floor((base64.length * 3) / 4)
    if (bytes > MAX_IMAGE_BYTES) {
      throw new Error('单张截图不能超过 5MB，请压缩后重试')
    }
    return {
      path: previewPath,
      name: nameFromPath(previewPath),
      mime,
      dataUrl: `data:${mime};base64,${base64}`,
      bytes,
    }
  }

  const { dataUrl, bytes } = await readH5File(path)
  if (bytes > MAX_IMAGE_BYTES) {
    throw new Error('单张截图不能超过 5MB，请压缩后重试')
  }
  const actualMime = dataUrl.match(/^data:(image\/[a-z]+);base64,/)?.[1]
  if (actualMime) mime = actualMime
  return {
    path,
    name: nameFromPath(path),
    mime,
    dataUrl,
    bytes,
  }
}

export async function pickChatImages(remaining: number): Promise<SelectedImage[]> {
  if (remaining <= 0) return []

  let result
  try {
    result = await Taro.chooseImage({
      count: Math.min(remaining, MAX_IMAGES),
      sizeType: ['compressed'],
      sourceType: ['album'],
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const cancelled = /cancel/i.test(message)
    throw new ImagePickError(cancelled ? '已取消' : '无法打开相册，请稍后重试', cancelled)
  }

  const picked: SelectedImage[] = []
  for (const path of result.tempFilePaths) {
    const image = await readImage(path)
    picked.push(image)
  }
  return picked
}
