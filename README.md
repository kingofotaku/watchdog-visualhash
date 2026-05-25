# Visual Hashing — Chrome Extension (MV3)

一个 Chrome 扩展，在密码输入框中显示基于密码的彩色条纹视觉哈希。
通过记忆你密码对应的颜色图案，你可以在不显示密码的情况下确认是否输入正确。

> 基于 [mozilla/watchdog-visualhash](https://github.com/mozilla/watchdog-visualhash) 重构为 Manifest V3。

## 功能特性

- 🎨 **视觉哈希** — 每个密码都有唯一的四色条纹图案
- 🔒 **SHA-256** — 使用 Web Crypto API 替代原版的 SHA-1
- ⚡ **即时响应** — 使用 `input` 事件替代原版的 keydown+setTimeout
- 👀 **智能检测** — 使用 MutationObserver 替代原版的 setInterval 轮询
- 🧂 **个人盐值** — 可配置私密前缀，使你的视觉哈希独一无二
- 🎛️ **可调色条数** — 支持 3-6 条色条
- 🌐 **全站生效** — 自动应用到所有网页的密码输入框
- 🔄 **SPA 兼容** — 支持动态加载的密码输入框

## 安装方法

1. 下载或克隆此项目
2. 打开 Chrome，访问 `chrome://extensions/`
3. 开启右上角的 **开发者模式**
4. 点击 **加载已解压的扩展程序**
5. 选择 `visual-hashing-mv3` 文件夹

## 使用方法

1. 安装后访问任何带有密码输入框的网页
2. 在密码框中输入密码时，背景会显示彩色条纹
3. 相同密码始终产生相同的颜色图案
4. 点击扩展图标可以：
   - 开关扩展
   - 调整色条数量 (3-6)
   - 设置个人盐值
   - 开关视觉噪点
   - 实时预览效果

## 与原版的区别

| 特性 | 原版 (MV2) | 新版 (MV3) |
|------|-----------|-----------|
| Manifest | V2 (无版本声明) | V3 |
| 哈希算法 | SHA-1 (手写实现) | SHA-256 (Web Crypto API) |
| 检测方式 | setInterval(4000) | MutationObserver + 备用轮询 |
| 事件监听 | keydown + setTimeout(10) | input 事件 |
| 标记方式 | `__visualHash` 属性 | `data-visual-hash` 属性 |
| 配置界面 | 无 | Popup UI |
| 个人盐值 | 仅 Jetpack 版支持 | 支持 |
| 色条数量 | 固定 4 条 | 可调 3-6 条 |
| 视觉噪点 | 始终开启 | 可配置 |

## 文件结构

```
visual-hashing-mv3/
├── manifest.json    — MV3 清单文件
├── content.js       — 内容脚本（密码检测 + 视觉哈希渲染）
├── background.js    — Service Worker（设置管理 + 徽章状态）
├── popup.html       — 弹出窗口结构
├── popup.css        — 弹出窗口样式
├── popup.js         — 弹出窗口逻辑
└── icons/           — 扩展图标
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

## 许可

基于 Mozilla 原始项目。仅供个人使用。
