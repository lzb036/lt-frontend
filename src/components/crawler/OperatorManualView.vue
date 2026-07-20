<script setup lang="ts">
import { Download, FullScreen } from '@element-plus/icons-vue'

const manualPdfUrl = '/docs/product-collection-system-manual.pdf'
const manualPdfEmbedUrl = `${manualPdfUrl}#view=FitH&toolbar=1&navpanes=0`

function openPdfManual() {
  window.open(manualPdfUrl, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <section class="operator-manual">
    <div class="operator-manual-actions">
      <el-button :icon="FullScreen" @click="openPdfManual">
        新窗口查看
      </el-button>
      <el-button
        type="primary"
        :icon="Download"
        tag="a"
        :href="manualPdfUrl"
        download="商品采集系统完整界面功能手册.pdf"
      >
        下载PDF
      </el-button>
    </div>

    <iframe
      class="operator-manual-pdf-frame"
      :src="manualPdfEmbedUrl"
      title="商品采集系统完整界面功能手册"
    />
  </section>
</template>

<style scoped>
.operator-manual {
  display: grid;
  min-height: calc(100vh - 56px);
  grid-template-rows: auto minmax(0, 1fr);
  gap: 14px;
}

.operator-manual-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.operator-manual-pdf-frame {
  width: 100%;
  height: calc(100vh - 126px);
  min-height: 620px;
  border: 1px solid var(--panel-border);
  background: var(--panel-muted);
}

@media (max-width: 720px) {
  .operator-manual {
    min-height: auto;
  }

  .operator-manual-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .operator-manual-pdf-frame {
    height: 76vh;
    min-height: 480px;
  }
}
</style>
