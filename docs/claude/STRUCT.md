# STRUCT.md

本文件包含项目的**目录结构**和**文件说明**，更新本文档只需要更新这2个部分。

## 目录结构

```
black-hole/
├── .claude/
│   └── settings.local.json
├── docs/
│   ├── claude/
│   │   └── STRUCT.md
│   └── reference/
│       └── PHYSICS_LAWS.md
├── src/
│   ├── components/
│   │   ├── RayTracer.ts
│   │   ├── SceneManager.ts
│   │   └── StarField.ts
│   ├── shaders/
│   │   ├── rayTracerFragment.glsl
│   │   └── rayTracerVertex.glsl
│   ├── main.ts
│   └── style.css
├── .gitignore
├── CLAUDE.md
├── README.md
├── index.html
├── package.json
├── package-lock.json
├── tsconfig.json
└── vite.config.ts
```

## 文件说明

| 文件/目录                              | 说明                                      |
|--------------------------------------|-------------------------------------------|
| `docs/`                              | 文档目录                                   |
| `docs/claude/STRUCT.md`             | 项目目录结构文档                           |
| `docs/reference/PHYSICS_LAWS.md`    | 物理规律参考文档                           |
| `src/`                               | 源代码目录                                 |
| `src/components/`                    | 组件目录                                   |
| `src/components/RayTracer.ts`        | 光线追踪器类，管理着色器材质和 uniform 变量 |
| `src/components/SceneManager.ts`     | 场景管理类，管理 Three.js 场景和 GUI      |
| `src/components/StarField.ts`        | 星空生成器类，生成程序化星空纹理           |
| `src/shaders/`                       | 着色器目录                                 |
| `src/shaders/rayTracerVertex.glsl`   | 顶点着色器                                |
| `src/shaders/rayTracerFragment.glsl` | 片元着色器，光线追踪核心实现              |
| `src/main.ts`                        | 应用入口文件                               |
| `src/style.css`                      | 全局样式文件                               |
| `index.html`                         | HTML 入口文件                              |
| `package.json`                       | npm 配置文件                               |
| `package-lock.json`                  | npm 依赖锁定文件                           |
| `tsconfig.json`                      | TypeScript 配置文件                        |
| `vite.config.ts`                     | Vite 配置文件                              |
| `.gitignore`                         | Git 忽略文件配置                           |
| `.claude/`                           | Claude 配置目录                            |
| `.claude/settings.local.json`        | Claude 本地设置                            |
| `CLAUDE.md`                          | Claude 项目指导文件                        |
| `README.md`                          | 项目说明文档                               |
