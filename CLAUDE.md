# CLAUDE.md

## 内容输出要求

1. 使用中文输出所有回答
2. 项目目录结构在[STRUCT.md](docs/claude/STRUCT.md)和[README.md](README.md), 需要更新目录结构时, 请确保：
   - 同层级内：目录在前，文件在后
   - 同类型（目录或文件）：按字母顺序排列
   - 被[.gitignore](.gitignore)排除的文件和目录不显示

## 项目概述

黑洞物理现象可视化3D模拟

## 技术栈

- **核心框架**: Three.js (r160+)
- **编程语言**: TypeScript
- **构建工具**: Vite
- **UI库**: lil-gui
- **物理引擎**: 自研（基于广义相对论）

## 特别说明

无需执行 npm run dev 来启动项目，我会保证服务器是启动的

## 专项说明文档

只读取下面列出的文档，其他的markdown文档是给用户参考的，不要读取

| 说明文档                                          | 读取条件               |
| ------------------------------------------------- | ---------------------- |
| [PLAN.md](PLAN.md)                                | 初步确定项目计划时     |
| [STRUCT.md](docs/claude/STRUCT.md)                | 需要查询项目目录结构时 |
| [PHYSICS_LAWS.md](docs/reference/PHYSICS_LAWS.md) | 需要了解相关物理规律时 |
