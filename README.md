# AI Hotpot

AI Hotpot 是一个专注于"内容热点识别"的前端演示项目，目标是从文本中快速抽取高价值主题、排序关注度，并支持接入 AI Code With 这样的 AI 服务进行增强分析。

## 项目功能

- 独特的深色科技风 UI 设计
- 文本输入与示例内容快速填充
- 使用 AI 提取热点主题、评分与理由
- API Key 缺失时自动切换为本地离线热度识别
- 结果卡片化展示与摘要输出
- GitHub Trending + Hacker News 实时 AI 新闻

## 运行方式

1. 在项目根目录执行：
   python -m http.server 8000
2. 打开浏览器访问：
   http://localhost:8000

## AI Code With 接入

在页面右上方的输入框中填写 AI Code With API Key，并选择模型即可直接调用 AI 进行热点识别。

示例：
- 模型：DeepSeek R1
- API 站点：https://api.aicodewith.com
- 说明：若未配置 Key，页面会自动使用内置本地识别逻辑继续工作。

## Agent Skills

项目中已附带一个示例说明文件：
- `agent-skills.md`

用于描述如何把 AI Hotpot 扩展成具备技能化工作流的 Agent 能力，例如：
- 行业趋势分析
- 竞争对手热点追踪
- 观点摘要与风险提示

## 目录结构

- `index.html`：页面入口
- `styles.css`：UI 样式
- `app.js`：逻辑与 AI Code With 调用
- `agent-skills.md`：Agent Skills 使用说明

## 验收建议

建议先验证：
- 页面正常渲染
- 点击"示例文本"可填充内容
- 未填 API Key 时可执行本地识别
- 填充 API Key 后，可触发 AI Code With 调用
- 结果区域展示热点和摘要
- 可获取 GitHub Trending 和 Hacker News 的 AI 新闻
