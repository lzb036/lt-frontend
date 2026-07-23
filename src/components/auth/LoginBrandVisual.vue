<script setup lang="ts">
import { Box, Connection, Goods, Key } from '@element-plus/icons-vue'

import yixinCalligraphy from '../../assets/yixin-calligraphy.png'
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
        <img class="brand-name-image" :src="yixinCalligraphy" alt="亦信" />
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
      <svg class="map-routes" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="map-route-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stop-color="#5ce7c9" stop-opacity="0.9" />
            <stop offset="1" stop-color="#f2b36f" stop-opacity="0.48" />
          </linearGradient>
        </defs>
        <line x1="50" y1="50" x2="82" y2="17" />
        <line x1="50" y1="50" x2="91" y2="53" />
        <line x1="50" y1="50" x2="75" y2="88" />
        <line x1="50" y1="50" x2="10" y2="73" />
      </svg>
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
  position: relative;
  display: flex;
  width: max-content;
  align-items: center;
  gap: 30px;
  padding: 10px 24px 14px 8px;
}

.brand-header::before {
  position: absolute;
  inset: -18px -34px -20px -24px;
  z-index: -1;
  background: radial-gradient(ellipse at center, rgba(67, 224, 195, 0.13), transparent 68%);
  content: '';
  filter: blur(8px);
}

.brand-mark {
  position: relative;
  display: grid;
  width: 94px;
  height: 94px;
  place-items: center;
  border: 1px solid rgba(173, 250, 234, 0.48);
  border-radius: 8px;
  background:
    linear-gradient(145deg, rgba(220, 255, 248, 0.2), rgba(87, 223, 195, 0.08)),
    rgba(7, 34, 43, 0.72);
  box-shadow:
    inset 0 0 32px rgba(87, 223, 195, 0.18),
    0 16px 40px rgba(0, 0, 0, 0.26),
    0 0 38px rgba(79, 226, 197, 0.12);
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
  width: 76px;
  height: 76px;
  filter: drop-shadow(0 7px 14px rgba(50, 219, 187, 0.24));
}

.brand-name {
  position: relative;
  display: inline-block;
  padding: 0 12px 13px 0;
}

.brand-name::after {
  position: absolute;
  right: -4px;
  bottom: 0;
  left: 0;
  height: 4px;
  border-radius: 50%;
  background:
    linear-gradient(90deg, #f4c765 0%, #72ead1 58%, rgba(114, 234, 209, 0.12) 92%, transparent 100%);
  box-shadow:
    0 0 12px rgba(93, 231, 204, 0.34),
    0 3px 0 rgba(10, 73, 72, 0.3);
  content: '';
  clip-path: polygon(0 38%, 42% 8%, 82% 22%, 100% 55%, 76% 72%, 31% 61%, 0 100%);
}

.brand-name-image {
  display: block;
  width: clamp(176px, 15vw, 230px);
  height: auto;
  aspect-ratio: 77 / 42;
  object-fit: contain;
  filter:
    drop-shadow(0 2px 0 rgba(5, 48, 52, 0.82))
    drop-shadow(0 10px 22px rgba(57, 224, 194, 0.24));
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
.map-routes,
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

.map-routes {
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.map-routes line {
  stroke: url('#map-route-gradient');
  stroke-width: 0.28;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}

.map-node {
  z-index: 2;
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
  top: 17%;
  left: 82%;
  transform: translate(-50%, -50%);
}

.node-two {
  top: 53%;
  left: 91%;
  transform: translate(-50%, -50%);
}

.node-three {
  top: 88%;
  left: 75%;
  transform: translate(-50%, -50%);
}

.node-four {
  top: 73%;
  left: 10%;
  transform: translate(-50%, -50%);
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

  .brand-mark {
    width: 76px;
    height: 76px;
  }

  .brand-mark img {
    width: 60px;
    height: 60px;
  }

  .brand-name-image {
    width: 172px;
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
    width: 68px;
    height: 68px;
  }

  .brand-mark img {
    width: 54px;
    height: 54px;
  }

  .brand-name-image {
    width: 150px;
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
