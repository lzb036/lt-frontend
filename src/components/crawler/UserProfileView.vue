<script setup lang="ts">
import { ElMessageBox } from 'element-plus'
import { SwitchButton, UserFilled } from '@element-plus/icons-vue'

import type { AuthSession } from '../../types/crawler'

const props = defineProps<{
  session: AuthSession | null
}>()

const emit = defineEmits<{
  logout: []
}>()

function formatDate(value?: string | null) {
  if (!value) {
    return '未记录'
  }
  return value.replace('T', ' ').replace('Z', '')
}

async function confirmLogout() {
  try {
    await ElMessageBox.confirm('确认退出当前账号？', '退出登录', {
      confirmButtonText: '退出登录',
      cancelButtonText: '取消',
      type: 'warning',
    })
    emit('logout')
  } catch {
  }
}
</script>

<template>
  <section class="page-stack">
    <div class="page-head">
      <div>
        <p class="eyebrow">Account Center</p>
        <h1>个人中心</h1>
      </div>
    </div>

    <section class="profile-card">
      <div class="profile-card-head">
        <div class="profile-identity">
          <span class="profile-avatar" aria-hidden="true">
            <el-icon :size="26">
              <UserFilled />
            </el-icon>
          </span>
          <div class="profile-identity-copy">
            <h2>{{ props.session?.displayName || '未设置名称' }}</h2>
          </div>
        </div>
        <el-button
          type="danger"
          plain
          :icon="SwitchButton"
          @click="confirmLogout"
        >
          退出登录
        </el-button>
      </div>

      <div class="profile-divider" />

      <dl class="profile-details">
        <div class="profile-detail">
          <dt>用户名</dt>
          <dd>{{ props.session?.username || '未记录' }}</dd>
        </div>
        <div class="profile-detail">
          <dt>名称</dt>
          <dd>{{ props.session?.displayName || '未设置' }}</dd>
        </div>
        <div class="profile-detail">
          <dt>注册时间</dt>
          <dd>{{ formatDate(props.session?.createdAt) }}</dd>
        </div>
      </dl>
    </section>
  </section>
</template>

<style scoped>
.profile-card {
  width: min(100%, 760px);
  padding: 28px 30px 24px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--panel-bg), transparent 4%);
  box-shadow: var(--shadow-sm);
}

.profile-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.profile-identity {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 14px;
}

.profile-avatar {
  display: grid;
  width: 54px;
  height: 54px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--accent-border);
  border-radius: 50%;
  background: var(--accent-soft);
  color: var(--accent);
}

.profile-identity-copy {
  min-width: 0;
}

.profile-identity h2 {
  margin: 0;
  color: var(--text-strong);
  font-size: 20px;
  line-height: 1.3;
}

.profile-divider {
  height: 1px;
  margin: 24px 0 4px;
  background: var(--panel-border);
}

.profile-details {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
}

.profile-detail {
  min-width: 0;
  padding: 16px 20px 4px 0;
}

.profile-detail + .profile-detail {
  padding-left: 20px;
  border-left: 1px solid var(--panel-border);
}

.profile-detail dt {
  margin-bottom: 7px;
  color: var(--text-faint);
  font-size: 12px;
}

.profile-detail dd {
  margin: 0;
  overflow: hidden;
  color: var(--text-strong);
  font-size: 14px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .profile-card {
    padding: 22px 20px 18px;
  }

  .profile-card-head {
    align-items: flex-start;
    flex-direction: column;
    gap: 18px;
  }

  .profile-details {
    grid-template-columns: 1fr;
  }

  .profile-detail,
  .profile-detail + .profile-detail {
    padding: 14px 0;
    border-left: 0;
    border-bottom: 1px solid var(--panel-border);
  }

  .profile-detail:last-child {
    border-bottom: 0;
  }
}
</style>
