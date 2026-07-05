export interface MeituImageSaveResult {
  imageBase64: string
  ext: string
  metadata?: unknown
}

interface MeituEditorInstance {
  destroy?: () => void
}

interface MeituImageEditorSdk {
  init: (options: Record<string, unknown>) => MeituEditorInstance | void
  saveImage: (callback: (imageBase64: string, ext: string, metadata?: unknown) => void) => void
  close?: () => void
}

interface OpenMeituImageEditorOptions {
  imageSrc: string
  title?: string
  onSave: (result: MeituImageSaveResult) => void | Promise<void>
}

const DEFAULT_GLOBAL_NAMES = ['Meitu', 'meitu', 'Xiuxiu', 'xiuxiu', 'MTImageEditor', 'MtImageEditor']

let sdkScriptPromise: Promise<void> | null = null
let editorInstance: MeituEditorInstance | void

export async function openMeituImageEditor(options: OpenMeituImageEditorOptions) {
  const imageSrc = options.imageSrc.trim()
  if (!imageSrc) {
    throw new Error('图片地址无效，请重试。')
  }

  await loadMeituSdkScript()
  const sdk = resolveMeituSdk()
  if (!sdk) {
    throw new Error('未找到美图图片编辑器 SDK，请先配置 SDK 地址。')
  }
  const accessKey = meituAccessKey()
  if (!accessKey) {
    throw new Error('未配置美图图片编辑器 accessKey。')
  }

  editorInstance?.destroy?.()
  editorInstance = sdk.init({
    moduleName: import.meta.env.VITE_MEITU_IMAGE_EDITOR_MODULE_NAME || 'image-editor-sdk',
    accessKey,
    title: options.title || '编辑图片',
    el: '',
    imageSrc,
    fullscreen: true,
    resizeAble: true,
  })

  sdk.saveImage((imageBase64, ext, metadata) => {
    void Promise.resolve(options.onSave({ imageBase64, ext, metadata }))
      .then(() => {
        sdk.close?.()
      })
  })
}

function meituAccessKey() {
  return String(import.meta.env.VITE_MEITU_IMAGE_EDITOR_ACCESS_KEY || '').trim()
}

async function loadMeituSdkScript() {
  const sdkUrl = String(import.meta.env.VITE_MEITU_IMAGE_EDITOR_SDK_URL || '').trim()
  if (!sdkUrl || resolveMeituSdk(false)) {
    return
  }
  if (!sdkScriptPromise) {
    sdkScriptPromise = new Promise((resolve, reject) => {
      const existing = Array.from(document.querySelectorAll<HTMLScriptElement>('script[data-meitu-image-editor-sdk]'))
        .find((script) => script.dataset.meituImageEditorSdk === sdkUrl)
      if (existing) {
        if (existing.dataset.loaded === 'true') {
          resolve()
          return
        }
        existing.addEventListener('load', () => resolve(), { once: true })
        existing.addEventListener('error', () => reject(new Error('美图图片编辑器 SDK 加载失败。')), { once: true })
        return
      }

      const script = document.createElement('script')
      script.src = sdkUrl
      script.async = true
      script.dataset.meituImageEditorSdk = sdkUrl
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true'
        resolve()
      }, { once: true })
      script.addEventListener('error', () => reject(new Error('美图图片编辑器 SDK 加载失败。')), { once: true })
      document.head.appendChild(script)
    })
  }
  await sdkScriptPromise
}

function resolveMeituSdk(throwIfMissing = true): MeituImageEditorSdk | null {
  const configuredGlobalName = String(import.meta.env.VITE_MEITU_IMAGE_EDITOR_GLOBAL || '').trim()
  const globalNames = configuredGlobalName ? [configuredGlobalName, ...DEFAULT_GLOBAL_NAMES] : DEFAULT_GLOBAL_NAMES
  const globalScope = window as unknown as Record<string, unknown>

  for (const name of globalNames) {
    const candidate = globalScope[name]
    if (isMeituSdk(candidate)) {
      return candidate
    }
    if (candidate && typeof candidate === 'object' && 'default' in candidate) {
      const defaultExport = (candidate as { default?: unknown }).default
      if (isMeituSdk(defaultExport)) {
        return defaultExport
      }
    }
  }

  if (throwIfMissing) {
    throw new Error('未找到美图图片编辑器 SDK，请先配置 SDK 地址。')
  }
  return null
}

function isMeituSdk(value: unknown): value is MeituImageEditorSdk {
  if (!value || typeof value !== 'object') {
    return false
  }
  const sdk = value as Partial<MeituImageEditorSdk>
  return typeof sdk.init === 'function' && typeof sdk.saveImage === 'function'
}
