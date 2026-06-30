import { h, reactive } from 'vue'
import { ElInput, ElMessage, ElMessageBox } from 'element-plus'

export interface StoreDeletionConfirmOptions {
  storeName: string
  ownerLabel?: string
}

interface CaptchaState {
  question: string
  answer: string
  input: string
}

export async function confirmStoreDeletion(options: StoreDeletionConfirmOptions) {
  const captcha = reactive<CaptchaState>({
    ...createCaptcha(),
    input: '',
  })
  const ownerText = options.ownerLabel ? `所属用户：${options.ownerLabel}` : ''

  await ElMessageBox({
    title: '删除店铺',
    type: 'warning',
    confirmButtonText: '确认删除',
    cancelButtonText: '取消',
    showCancelButton: true,
    beforeClose(action, _instance, done) {
      if (action !== 'confirm') {
        done()
        return
      }
      if (!captcha.input.trim()) {
        ElMessage.warning('请输入验证码')
        return
      }
      if (captcha.input.trim() !== captcha.answer) {
        ElMessage.warning('验证码不正确')
        refreshCaptcha(captcha)
        return
      }
      done()
    },
    message: () => h('div', { class: 'store-delete-confirm' }, [
      h('p', { class: 'store-delete-confirm__warning' }, `确认删除店铺「${options.storeName}」？`),
      ownerText ? h('p', { class: 'store-delete-confirm__meta' }, ownerText) : null,
      h('p', { class: 'store-delete-confirm__desc' }, '删除成功后，本地该店铺及其关联店铺商品数据会被全部清除。该操作不可恢复，请输入验证码后继续。'),
      h('div', { class: 'store-delete-confirm__captcha' }, [
        h(ElInput, {
          modelValue: captcha.input,
          'onUpdate:modelValue': (value: string) => {
            captcha.input = value
          },
          autocomplete: 'off',
          inputmode: 'numeric',
          placeholder: '请输入验证码',
          onKeydown: (event: Event | KeyboardEvent) => {
            if (event instanceof KeyboardEvent && event.key === 'Enter') {
              const confirmButton = document.querySelector<HTMLElement>('.el-message-box__btns .el-button--primary')
              confirmButton?.click()
            }
          },
        }),
        h('button', {
          class: 'store-delete-confirm__code',
          type: 'button',
          onClick: () => refreshCaptcha(captcha),
        }, captcha.question),
      ]),
    ]),
  })
}

function refreshCaptcha(captcha: CaptchaState) {
  const next = createCaptcha()
  captcha.question = next.question
  captcha.answer = next.answer
  captcha.input = ''
}

function createCaptcha() {
  const first = randomNumber(2, 9)
  const second = randomNumber(1, 8)
  const useMinus = Math.random() > 0.5
  if (useMinus) {
    const max = Math.max(first, second)
    const min = Math.min(first, second)
    return {
      question: `${max}-${min}=?`,
      answer: String(max - min),
    }
  }
  return {
    question: `${first}+${second}=?`,
    answer: String(first + second),
  }
}

function randomNumber(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
