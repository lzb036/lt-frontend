<script setup lang="ts">
import { Box, Connection, Goods, Key } from '@element-plus/icons-vue'
</script>

<template>
  <aside class="brand-visual" aria-label="乐天商品采集平台">
    <div class="brand-backdrop" aria-hidden="true">
      <span class="orbit orbit-one"></span>
      <span class="orbit orbit-two"></span>
      <span class="signal-line signal-line-one"></span>
      <span class="signal-line signal-line-two"></span>
      <span class="signal-line signal-line-three"></span>
    </div>

    <header class="brand-header">
      <span class="brand-mark" aria-hidden="true">
        <img src="/favicon.svg" alt="" />
      </span>
      <span class="brand-name">
        <strong>亦信</strong>
      </span>
    </header>

    <div class="brand-stage">
      <p class="brand-kicker">
        <span class="status-dot"></span>
        RAKUTEN PRODUCT COLLECTOR
      </p>
      <h1>专注乐天商品<br />采集与归档</h1>
      <p class="brand-summary">从乐天店铺接入、商品采集到数据归档，在一个清晰可靠的工作台完成。</p>
    </div>

    <div class="data-map" aria-hidden="true">
      <span class="map-grid"></span>
      <span class="map-glow"></span>
      <span class="map-route route-one"></span>
      <span class="map-route route-two"></span>
      <span class="map-route route-three"></span>
      <span class="map-node node-origin">
        <span class="node-pulse"></span>
        <img src="/favicon.svg" alt="" />
      </span>
      <span class="map-node node-one"><el-icon><Key /></el-icon></span>
      <span class="map-node node-two"><el-icon><Connection /></el-icon></span>
      <span class="map-node node-three"><el-icon><Goods /></el-icon></span>
      <span class="map-node node-four"><el-icon><Box /></el-icon></span>
      <span class="route-spark spark-one"></span>
      <span class="route-spark spark-two"></span>
    </div>

    <footer class="brand-footer">
      <span>店铺接入</span>
      <span>采集任务</span>
      <span>商品归档</span>
      <span>数据审校</span>
    </footer>
  </aside>
</template>

<style scoped>
.brand-visual {
  position: relative;
  isolation: isolate;
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: space-between;
  overflow: hidden;
  background:
    linear-gradient(148deg, #071a2b 0%, #0b2431 48%, #102f32 100%);
  padding: clamp(28px, 4.2vw, 64px);
  color: #f6fbff;
}

.brand-visual::before {
  position: absolute;
  inset: 0;
  z-index: -2;
  background:
    radial-gradient(circle at 76% 18%, rgba(48, 209, 180, 0.18), transparent 28%),
    radial-gradient(circle at 14% 84%, rgba(255, 146, 90, 0.13), transparent 24%),
    linear-gradient(115deg, transparent 0 48%, rgba(255, 255, 255, 0.035) 48% 49%, transparent 49% 100%);
  content: '';
}

.brand-visual::after {
  position: absolute;
  inset: 0;
  z-index: -1;
  background-image:
    linear-gradient(rgba(174, 237, 226, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(174, 237, 226, 0.07) 1px, transparent 1px);
  background-position: center;
  background-size: 52px 52px;
  content: '';
  mask-image: linear-gradient(to bottom, transparent, black 18%, black 82%, transparent);
  opacity: 0.52;
  transform: perspective(520px) rotateX(62deg) scale(1.4) translateY(26%);
  transform-origin: center bottom;
}

.brand-backdrop,
.brand-backdrop > span {
  position: absolute;
  pointer-events: none;
}

.brand-backdrop {
  inset: 0;
}

.orbit {
  border: 1px solid rgba(141, 235, 217, 0.13);
  border-radius: 50%;
}

.orbit-one {
  top: 13%;
  right: -18%;
  width: min(42vw, 620px);
  aspect-ratio: 1;
}

.orbit-two {
  right: -7%;
  bottom: -24%;
  width: min(34vw, 500px);
  aspect-ratio: 1;
}

.signal-line {
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(135, 236, 217, 0.46), transparent);
  transform: rotate(-24deg);
}

.signal-line-one {
  top: 31%;
  right: -9%;
  width: 58%;
}

.signal-line-two {
  top: 56%;
  left: -13%;
  width: 48%;
}

.signal-line-three {
  right: -16%;
  bottom: 17%;
  width: 54%;
}

.brand-header,
.brand-stage,
.brand-footer {
  position: relative;
  z-index: 2;
}

.brand-header {
  display: flex;
  align-items: center;
  gap: 18px;
}

.brand-mark {
  position: relative;
  display: grid;
  width: 64px;
  height: 64px;
  place-items: center;
  border: 1px solid rgba(161, 244, 226, 0.38);
  border-radius: 8px;
  background: rgba(201, 255, 244, 0.09);
  box-shadow:
    inset 0 0 22px rgba(87, 223, 195, 0.1),
    0 10px 28px rgba(0, 0, 0, 0.16);
}

.brand-mark::before,
.brand-mark::after {
  position: absolute;
  width: 9px;
  height: 9px;
  border-color: #ff9b64;
  content: '';
}

.brand-mark::before {
  top: -1px;
  right: -1px;
  border-top: 2px solid;
  border-right: 2px solid;
}

.brand-mark::after {
  bottom: -1px;
  left: -1px;
  border-bottom: 2px solid;
  border-left: 2px solid;
}

.brand-mark img {
  display: block;
  width: 50px;
  height: 50px;
}

.brand-name {
  position: relative;
  display: inline-block;
  padding: 0 4px 6px 0;
}

.brand-name::after {
  position: absolute;
  right: 1px;
  bottom: 0;
  left: 0;
  height: 2px;
  background: linear-gradient(90deg, #f3c96b, rgba(83, 224, 193, 0.68), transparent);
  content: '';
}

.brand-name strong {
  display: block;
  background: linear-gradient(118deg, #ffffff 10%, #d8fff7 58%, #f5d887 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  -webkit-text-fill-color: transparent;
  font-family: "STKaiti", "KaiTi", "FZKai-Z03", "Microsoft YaHei", serif;
  font-size: clamp(32px, 2.8vw, 42px);
  font-weight: 900;
  line-height: 1;
  letter-spacing: 4px;
  text-shadow: 0 8px 22px rgba(60, 221, 192, 0.14);
}

.brand-stage {
  width: min(600px, 58%);
  margin: auto 0;
  padding: clamp(34px, 6vh, 76px) 0;
}

.brand-kicker {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 18px;
  color: #92cfc6;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 1.6px;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #54e1bf;
  box-shadow: 0 0 0 5px rgba(84, 225, 191, 0.11), 0 0 18px rgba(84, 225, 191, 0.7);
}

.brand-stage h1 {
  margin: 0;
  font-size: clamp(42px, 5vw, 72px);
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: 0;
}

.brand-summary {
  width: min(520px, 86%);
  margin: 22px 0 0;
  color: rgba(218, 233, 235, 0.7);
  font-size: 15px;
  line-height: 1.8;
}

.data-map {
  position: absolute;
  top: 50%;
  right: clamp(36px, 5vw, 90px);
  z-index: 1;
  width: clamp(280px, 29vw, 420px);
  aspect-ratio: 1;
  transform: translateY(-42%);
}

.map-grid,
.map-glow,
.map-route,
.map-node,
.route-spark {
  position: absolute;
}

.map-grid {
  inset: 0;
  border: 1px solid rgba(151, 231, 216, 0.13);
  border-radius: 50%;
  background:
    linear-gradient(rgba(114, 221, 202, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(114, 221, 202, 0.07) 1px, transparent 1px);
  background-size: 24px 24px;
  mask-image: radial-gradient(circle, black 34%, transparent 72%);
}

.map-glow {
  inset: 18%;
  border-radius: 50%;
  background: rgba(43, 205, 177, 0.12);
  filter: blur(24px);
}

.map-route {
  top: 50%;
  left: 50%;
  height: 1px;
  background: linear-gradient(90deg, rgba(79, 224, 196, 0.74), rgba(255, 161, 103, 0.26));
  transform-origin: left center;
}

.route-one {
  width: 38%;
  transform: rotate(-42deg);
}

.route-two {
  width: 42%;
  transform: rotate(17deg);
}

.route-three {
  width: 36%;
  transform: rotate(132deg);
}

.map-node {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border: 1px solid rgba(147, 239, 220, 0.3);
  border-radius: 8px;
  background: rgba(6, 29, 40, 0.88);
  color: #82e4d0;
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.22);
}

.map-node .el-icon {
  font-size: 19px;
}

.node-origin {
  top: 50%;
  left: 50%;
  width: 58px;
  height: 58px;
  transform: translate(-50%, -50%);
}

.node-origin img {
  width: 43px;
  height: 43px;
}

.node-pulse {
  position: absolute;
  inset: -14px;
  border: 1px solid rgba(91, 232, 204, 0.26);
  border-radius: 12px;
  animation: node-pulse 2.8s ease-out infinite;
}

.node-one {
  top: 12%;
  right: 12%;
}

.node-two {
  top: 48%;
  right: 2%;
}

.node-three {
  right: 20%;
  bottom: 5%;
}

.node-four {
  bottom: 22%;
  left: 7%;
}

.route-spark {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ff9b64;
  box-shadow: 0 0 14px rgba(255, 155, 100, 0.9);
}

.spark-one {
  top: 32%;
  left: 64%;
  animation: spark-float 3.4s ease-in-out infinite;
}

.spark-two {
  right: 18%;
  bottom: 33%;
  animation: spark-float 3.4s 1.2s ease-in-out infinite;
}

.brand-footer {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  width: min(650px, 100%);
  border-top: 1px solid rgba(186, 232, 225, 0.14);
  padding-top: 20px;
}

.brand-footer span {
  position: relative;
  color: rgba(217, 233, 235, 0.58);
  font-size: 12px;
  font-weight: 600;
}

.brand-footer span::before {
  display: inline-block;
  width: 4px;
  height: 4px;
  margin-right: 8px;
  border-radius: 50%;
  background: #55d6bd;
  content: '';
  vertical-align: 2px;
}

@keyframes node-pulse {
  0% {
    opacity: 0.85;
    transform: scale(0.82);
  }
  70%,
  100% {
    opacity: 0;
    transform: scale(1.35);
  }
}

@keyframes spark-float {
  0%,
  100% {
    opacity: 0.45;
    transform: translate3d(0, 0, 0);
  }
  50% {
    opacity: 1;
    transform: translate3d(8px, -7px, 0);
  }
}

@media (max-width: 1120px) {
  .data-map {
    right: -24px;
    width: 230px;
    opacity: 0.58;
  }

  .brand-stage {
    width: min(460px, calc(100% - 190px));
  }

  .brand-stage h1 {
    font-size: clamp(40px, 5.6vw, 60px);
  }
}

@media (max-width: 900px) {
  .brand-visual {
    min-height: 248px;
    padding: 24px 28px;
  }

  .brand-stage {
    width: min(470px, calc(100% - 230px));
    padding: 32px 0 24px;
  }

  .brand-stage h1 {
    font-size: 34px;
  }

  .brand-summary {
    max-width: 430px;
    margin-top: 13px;
    font-size: 13px;
  }

  .data-map {
    top: 56%;
    right: 20px;
    width: 210px;
    opacity: 0.52;
  }

  .brand-footer {
    display: none;
  }
}

@media (max-width: 560px) {
  .brand-visual {
    min-height: 210px;
    padding: 20px;
  }

  .brand-stage {
    width: 100%;
    padding: 26px 0 8px;
  }

  .brand-mark {
    width: 54px;
    height: 54px;
  }

  .brand-mark img {
    width: 42px;
    height: 42px;
  }

  .brand-name strong {
    font-size: 31px;
  }

  .brand-kicker,
  .brand-summary,
  .data-map {
    display: none;
  }

  .brand-stage h1 {
    max-width: 300px;
    font-size: 31px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .node-pulse,
  .route-spark {
    animation: none;
  }
}
</style>
