<script setup lang="ts">
import { RefreshLeft } from '@element-plus/icons-vue'

import { useTheme } from '../../composables/useTheme'

const {
  themeSettings,
  themeModeSegmentOptions,
  themePresetOptions,
  themeFontOptions,
  themeRadiusOptions,
  themeDensityOptions,
  themeSurfaceOptions,
  themeNavigationOptions,
  themeContentWidthOptions,
  themeTableOptions,
  themeContrastOptions,
  themeShadowOptions,
  themeMotionOptions,
  updateThemeSetting,
  resetThemeSettings,
} = useTheme()

const advancedGroups = [
  { key: 'navigation' as const, title: '导航', options: themeNavigationOptions },
  { key: 'contentWidth' as const, title: '内容宽度', options: themeContentWidthOptions },
  { key: 'table' as const, title: '表格', options: themeTableOptions },
  { key: 'contrast' as const, title: '对比度', options: themeContrastOptions },
  { key: 'shadow' as const, title: '阴影', options: themeShadowOptions },
  { key: 'motion' as const, title: '动效', options: themeMotionOptions },
]
</script>

<template>
  <section class="page-stack">
    <div class="theme-page-head">
      <el-button :icon="RefreshLeft" @click="resetThemeSettings">恢复默认</el-button>
    </div>

    <div class="theme-settings">
      <section class="theme-section theme-section-wide">
        <div class="theme-section-head">
          <h2>外观模式</h2>
        </div>
        <el-segmented
          v-model="themeSettings.mode"
          class="theme-mode-switch"
          :options="themeModeSegmentOptions"
        />
      </section>

      <section class="theme-section theme-section-wide">
        <div class="theme-section-head">
          <h2>主题色彩</h2>
        </div>
        <div class="theme-preset-grid">
          <button
            v-for="option in themePresetOptions"
            :key="option.key"
            class="theme-choice theme-preset-choice"
            :class="{ 'theme-choice-active': themeSettings.preset === option.key }"
            type="button"
            @click="updateThemeSetting('preset', option.key)"
          >
            <span
              class="theme-preset-swatch"
              :style="{
                '--preset-primary': option.primary,
                '--preset-accent': option.accent,
                '--preset-surface': option.surface,
              }"
            />
            <span>{{ option.label }}</span>
          </button>
        </div>
      </section>

      <section class="theme-section">
        <div class="theme-section-head">
          <h2>字体</h2>
        </div>
        <div class="theme-option-grid">
          <button
            v-for="option in themeFontOptions"
            :key="option.key"
            class="theme-choice"
            :class="{ 'theme-choice-active': themeSettings.font === option.key }"
            type="button"
            @click="updateThemeSetting('font', option.key)"
          >
            <span>{{ option.label }}</span>
            <small
              class="theme-font-sample"
              :style="{ fontFamily: option.fontFamily }"
            >
              {{ option.sample }}
            </small>
          </button>
        </div>
      </section>

      <section class="theme-section">
        <div class="theme-section-head">
          <h2>界面密度</h2>
        </div>
        <div class="theme-option-grid">
          <button
            v-for="option in themeDensityOptions"
            :key="option.key"
            class="theme-choice"
            :class="{ 'theme-choice-active': themeSettings.density === option.key }"
            type="button"
            @click="updateThemeSetting('density', option.key)"
          >
            {{ option.label }}
          </button>
        </div>
      </section>

      <section class="theme-section">
        <div class="theme-section-head">
          <h2>圆角</h2>
        </div>
        <div class="theme-option-grid">
          <button
            v-for="option in themeRadiusOptions"
            :key="option.key"
            class="theme-choice"
            :class="{ 'theme-choice-active': themeSettings.radius === option.key }"
            type="button"
            @click="updateThemeSetting('radius', option.key)"
          >
            {{ option.label }}
          </button>
        </div>
      </section>

      <section class="theme-section">
        <div class="theme-section-head">
          <h2>表面质感</h2>
        </div>
        <div class="theme-option-grid">
          <button
            v-for="option in themeSurfaceOptions"
            :key="option.key"
            class="theme-choice"
            :class="{ 'theme-choice-active': themeSettings.surface === option.key }"
            type="button"
            @click="updateThemeSetting('surface', option.key)"
          >
            {{ option.label }}
          </button>
        </div>
      </section>

      <section
        v-for="group in advancedGroups"
        :key="group.key"
        class="theme-section"
      >
        <div class="theme-section-head">
          <h2>{{ group.title }}</h2>
        </div>
        <div class="theme-option-grid">
          <button
            v-for="option in group.options"
            :key="option.key"
            class="theme-choice"
            :class="{ 'theme-choice-active': themeSettings[group.key] === option.key }"
            type="button"
            @click="updateThemeSetting(group.key, option.key)"
          >
            {{ option.label }}
          </button>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.page-stack {
  display: grid;
  gap: 18px;
}

.theme-page-head {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
}

.theme-settings {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.theme-section {
  display: grid;
  gap: 14px;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-md);
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
  padding: var(--panel-padding);
}

.theme-section-wide {
  grid-column: 1 / -1;
}

.theme-section-head h2 {
  margin: 0;
  color: var(--text-main);
  font-size: 15px;
  font-weight: 800;
}

.theme-mode-switch {
  width: 100%;
}

.theme-preset-grid,
.theme-option-grid {
  display: grid;
  gap: 10px;
}

.theme-preset-grid {
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}

.theme-option-grid {
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}

.theme-choice {
  display: flex;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-sm);
  background: var(--panel-bg);
  color: var(--text-soft);
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  transition:
    border-color var(--motion-fast) ease,
    background var(--motion-fast) ease,
    color var(--motion-fast) ease,
    box-shadow var(--motion-fast) ease;
}

.theme-font-sample {
  color: var(--text-faint);
  font-size: 11px;
  font-weight: 500;
}

.theme-choice:hover,
.theme-choice:focus-visible {
  border-color: var(--accent-border);
  background: var(--accent-soft);
  color: var(--accent);
  outline: none;
}

.theme-choice-active {
  border-color: var(--accent-border);
  background: var(--accent-soft);
  color: var(--accent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent), transparent 74%);
}

.theme-preset-choice {
  justify-content: flex-start;
  padding: 0 12px;
}

.theme-preset-swatch {
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  border: 1px solid color-mix(in srgb, var(--preset-primary), #ffffff 32%);
  border-radius: var(--radius-xs);
  background:
    linear-gradient(135deg, var(--preset-primary) 0 45%, var(--preset-accent) 45% 72%, var(--preset-surface) 72% 100%);
}

@media (max-width: 820px) {
  .theme-settings {
    grid-template-columns: 1fr;
  }

  .theme-section-wide {
    grid-column: auto;
  }
}

@media (max-width: 640px) {
  .theme-page-head {
    align-items: flex-start;
  }

  .theme-preset-grid,
  .theme-option-grid {
    grid-template-columns: 1fr;
  }
}
</style>
