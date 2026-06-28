# FC Platform - 红白机模拟平台

高度还原任天堂 Famicom（红白机）体验的桌面模拟平台。

## 功能特性

- **红白机主机界面** — CSS 绘制的经典奶白+深红 Famicom 造型，含卡槽、弹出杆、电源开关、重置按钮、LED 指示灯
- **卡带收藏架** — 右侧面板展示卡带收藏，支持筛选、搜索、创建自定义卡带
- **多合一游戏菜单** — 高度还原经典"64合1"/"999合1"黄卡选择界面，深蓝色背景 + 像素字体 + 编号游戏列表
- **NES 音效合成器** — Web Audio API 合成的 FC 风格方波音效，光标移动、确认、翻页、卡带插入等全部配有还原音效
- **统一输入系统** — 键盘 + 手柄（Gamepad API）统一抽象，支持按键重绑定、自动重复（300ms/80ms 还原 FC 手感）
- **卡带导入/导出** — 支持 .fcpack 格式分享卡带配置（不含 ROM 文件）

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建生产版本
npm run build

# 打包安装程序
npm run package
```

## 项目结构

```
fc-platform/
├── electron/          # Electron 主进程
│   ├── main.ts        # 主进程入口（窗口管理、IPC、持久化存储）
│   └── preload.ts     # 预加载脚本（安全 IPC 桥接）
├── shared/            # 主/渲染进程共享类型
│   └── types.ts       # 卡带、设置、IPC 通道等类型定义
├── src/               # 渲染进程（React 前端）
│   ├── components/
│   │   ├── console/   # 红白机主机界面组件
│   │   ├── cartridge/ # 卡带卡片和收藏架组件
│   │   ├── menu/      # 多合一游戏选择菜单
│   │   ├── game/      # 游戏运行画面（待实现）
│   │   └── settings/  # 设置面板（待实现）
│   ├── audio/         # NES 风格音效合成引擎
│   ├── input/         # 键盘+手柄统一输入管理器
│   ├── store/         # Zustand 状态管理（应用/卡带/设置）
│   ├── core/          # NES 模拟器核心适配器（待集成 JSNES）
│   └── utils/         # ROM 解析等工具函数
├── data/              # 默认卡带数据
└── electron.vite.config.ts
```

## 技术栈

- **Electron 33** — 桌面框架
- **React 18 + TypeScript** — UI 框架
- **Vite 5** — 构建工具（electron-vite）
- **Zustand** — 状态管理
- **Tailwind CSS 3** — 样式系统
- **Web Audio API** — 音效合成
- **HTML5 Gamepad API** — 手柄支持
- **electron-store** — 持久化配置

## 默认操控

| 动作 | 键盘 (P1) | 手柄 |
|------|-----------|------|
| 上 | ↑ / W | D-pad ↑ |
| 下 | ↓ / S | D-pad ↓ |
| 左 | ← / A | D-pad ← |
| 右 | → / D | D-pad → |
| A | J / Z | A (×) |
| B | K / X | B (○) |
| Start | Enter | Start |
| Select | Shift | Select |

## 后续开发路线

- [ ] 集成 JSNES 模拟器核心，实现游戏运行
- [ ] CRT 扫描线滤镜和画面特效
- [ ] 即时存档/读档系统
- [ ] 卡带编辑器（可视化创建/编辑卡带）
- [ ] 更多主机皮肤主题（AV Famicom / NES 灰机）
- [ ] 在线卡带分享平台
- [ ] 升级到 binjNES WASM 核心获得更高精度

## 注意事项

本平台不提供任何游戏 ROM 文件。用户需自行准备合法的游戏 ROM。
