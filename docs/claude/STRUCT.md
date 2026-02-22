# STRUCT.md

本文件包含项目的**目录结构**。

## 内容输出要求

需要更新目录结构时, 请确保：

- 同层级内：目录在前，文件在后
- 同类型（目录或文件）：按字母顺序排列
- 读取[.gitignore](/.gitignore)文件，被其排除的文件和目录不显示

## 目录结构

```
black-hole/
├── docs/                         # 文档目录
│   ├── claude/                   # Claude 指令文档
│   │   ├── GIT.md                # Git 提交规范
│   │   └── STRUCT.md             # 项目目录结构说明（本文件）
│   └── reference/                # 参考文档
│       └── PHYSICS_LAWS.md       # 物理定律参考文档
├── src/                          # 源代码目录
│   ├── components/               # 组件目录
│   │   ├── NebulaField.ts        # 星云背景生成组件
│   │   ├── RayTracer.ts          # 光线追踪渲染组件
│   │   ├── SceneManager.ts       # 场景管理器
│   │   └── StarField.ts          # 星空背景生成组件
│   ├── shaders/                  # 着色器目录
│   │   ├── rayTracerFragment.glsl  # 光线追踪片段着色器
│   │   └── rayTracerVertex.glsl    # 光线追踪顶点着色器
│   ├── main.ts                   # 应用入口
│   └── style.css                 # 全局样式
├── .gitignore                    # Git 忽略文件配置
├── CLAUDE.md                     # Claude 开发指令
├── README.md                     # 项目说明文档
├── demo.jpg                      # 演示截图
├── index.html                    # HTML 入口文件
├── package.json                  # 项目依赖配置
├── tsconfig.json                 # TypeScript 配置
└── vite.config.ts                # Vite 构建配置
```
