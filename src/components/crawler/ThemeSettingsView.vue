<script setup lang="ts">
import { useTheme } from '../../composables/useTheme'

const {
  themeSettings,
  themeModeSegmentOptions,
  themePresetOptions,
  themeFontOptions,
  themeRadiusOptions,
  themeDensityOptions,
  themeSurfaceOptions,
  updateThemeSetting,
} = useTheme()
</script>

<template>
  <section class="page-stack">
    <section class="theme-panel">
      <section class="theme-section">
        <div class="theme-section-head">
          <h2>模式</h2>
        </div>
        <el-segmented
          v-model="themeSettings.mode"
          class="theme-mode-switch"
          :options="themeModeSegmentOptions"
        />
      </section>

      <section class="theme-section">
        <div class="theme-section-head">
          <h2>色彩</h2>
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
            {{ option.label }}
          </button>
        </div>
      </section>

      <section class="theme-section">
        <div class="theme-section-head">
          <h2>密度</h2>
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
          <h2>表面</h2>
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
    </section>
  </section>
</template>

<style scoped>
.page-stack {
  display: grid;
  gap: 18px;
}

.theme-panel {
  display: grid;
  gap: 18px;
  width: 100%;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
}

.theme-section {
  display: grid;
  gap: 14px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--panel-bg);
  box-shadow: var(--shadow-sm);
  padding: 18px;
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
  transition: border-color 0.16s ease, background 0.16s ease, color 0.16s ease, box-shadow 0.16s ease;
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

@media (max-width: 1180px) {
  .theme-panel {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .theme-preset-grid,
  .theme-option-grid {
    grid-template-columns: 1fr;
  }
}
</style>
