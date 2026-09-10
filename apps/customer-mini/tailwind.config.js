/**
 * 小程序端 Tailwind 配置（批次 7.1 任务 A）
 * - presets 相对路径引 packages/config/tailwind-preset.js（VI v1.1 冻结版，色值零改动、零自创）
 * - preflight 关闭：小程序无 body/html 重置语义，避免与 NutUI/Taro 组件基样式冲突
 */
const philiaPreset = require('../../packages/config/tailwind-preset.js');

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [philiaPreset],
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  corePlugins: {
    preflight: false,
  },
};
