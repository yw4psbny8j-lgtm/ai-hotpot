/**
 * api.js - API调用模块
 * 包含：Hacker News API、GitHub API、数据获取
 */

import { withTimeout } from './utils.js';

/**
 * GitHub Trending 默认数据
 */
export const FALLBACK_GITHUB_NEWS = [
  { rank: 1, title: 'microsoft/ai', summary: '微软 AI 工作区与模型工程工具合集。', url: 'https://github.com/microsoft', source: 'GitHub', stars: 12000, language: '多语言' },
  { rank: 2, title: 'huggingface/transformers', summary: '大规模预训练模型与 NLP 工具生态。', url: 'https://github.com/huggingface/transformers', source: 'GitHub', stars: 115000, language: 'Python' },
  { rank: 3, title: 'openai/openai-cookbook', summary: 'OpenAI API 使用入门与高级例程。', url: 'https://github.com/openai/openai-cookbook', source: 'GitHub', stars: 60000, language: 'Jupyter' },
  { rank: 4, title: 'langchain-ai/langchain', summary: 'LLM 应用开发框架与 Agent 工作流。', url: 'https://github.com/langchain-ai/langchain', source: 'GitHub', stars: 87000, language: 'Python' },
  { rank: 5, title: 'microsoft/autogen', summary: '多智能体协作的自动化框架。', url: 'https://github.com/microsoft/autogen', source: 'GitHub', stars: 40000, language: 'Python' }
];

/**
 * Hacker News 默认数据
 */
export const FALLBACK_HN_NEWS = [
  { rank: 1, title: 'AI agents are becoming the new app layer', summary: '围绕 Agent 与工作流的讨论持续升温。', url: 'https://news.ycombinator.com/', source: 'Hacker News', score: 420, comments: 120 },
  { rank: 2, title: 'OpenAI launches stronger reasoning models for enterprise', summary: '企业部署与推理能力继续推动市场关注。', url: 'https://news.ycombinator.com/', source: 'Hacker News', score: 390, comments: 93 },
  { rank: 3, title: 'LLM evals are finally becoming a product category', summary: '模型评测、质量治理与反馈闭环受到重视。', url: 'https://news.ycombinator.com/', source: 'Hacker News', score: 330, comments: 77 }
];

/**
 * AI关键词列表
 */
const AI_KEYWORDS = [
  'ai', 'llm', 'gpt', 'openai', 'anthropic', 'claude', 'gemini',
  'machine learning', 'deep learning', 'neural', 'transformer',
  'chatbot', 'artificial intelligence', 'copilot', 'diffusion',
  'stable diffusion', 'midjourney', 'langchain', 'rag'
];

/**
 * 获取Hacker News AI相关文章
 * @returns {Promise<Array>} AI相关文章列表
 */
export async function fetchHackerNewsAI() {
  try {
    const data = await withTimeout(async () => {
      const response = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
      const ids = await response.json();
      const topIds = Array.isArray(ids) ? ids.slice(0, 50) : [];

      const stories = await Promise.all(
        topIds.map((id) =>
          fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
            .then((res) => res.json())
            .catch(() => null)
        )
      );

      return stories
        .filter((story) => {
          if (!story || !story.title) return false;
          const title = story.title.toLowerCase();
          return AI_KEYWORDS.some((kw) => title.includes(kw));
        })
        .slice(0, 10)
        .map((story, index) => ({
          rank: index + 1,
          title: story.title,
          summary: '',
          url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
          source: 'Hacker News',
          score: story.score || 0,
          comments: story.descendants || 0,
          time: new Date((story.time || Date.now() / 1000) * 1000).toLocaleString('zh-CN')
        }));
    }, 6000);

    return data.length ? data : FALLBACK_HN_NEWS;
  } catch (error) {
    console.error('Hacker News 获取失败:', error);
    return FALLBACK_HN_NEWS;
  }
}

/**
 * 获取GitHub Trending AI项目
 * @returns {Promise<Array>} GitHub AI项目列表
 */
export async function fetchGitHubTrendingAI() {
  try {
    const repoItems = await withTimeout(async () => {
      const queries = [
        'machine learning created:>2024-01-01',
        'artificial intelligence created:>2024-01-01',
        'llm created:>2024-01-01',
        'gpt created:>2024-01-01'
      ];

      for (const query of queries) {
        const response = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=10`);
        if (!response.ok) continue;
        const data = await response.json();
        if (Array.isArray(data.items) && data.items.length) {
          return data.items;
        }
      }

      return [];
    }, 6000);

    if (!repoItems.length) {
      return FALLBACK_GITHUB_NEWS;
    }

    return repoItems
      .filter((repo) => repo.stargazers_count > 100)
      .slice(0, 10)
      .map((repo, index) => ({
        rank: index + 1,
        title: repo.full_name,
        summary: repo.description || '暂无描述',
        url: repo.html_url,
        source: 'GitHub',
        stars: repo.stargazers_count,
        language: repo.language || '未知',
        time: new Date(repo.created_at).toLocaleDateString('zh-CN')
      }));
  } catch (error) {
    console.error('GitHub Trending 获取失败:', error);
    return FALLBACK_GITHUB_NEWS;
  }
}

/**
 * 获取所有AI新闻（Hacker News + GitHub Trending）
 * @returns {Promise<Array>} 合并后的新闻列表
 */
export async function fetchAllAINews() {
  const [hnResults, ghResults] = await Promise.allSettled([
    fetchHackerNewsAI(),
    fetchGitHubTrendingAI()
  ]);

  const allNews = [];

  if (hnResults.status === 'fulfilled') {
    allNews.push(...hnResults.value);
  }
  if (ghResults.status === 'fulfilled') {
    allNews.push(...ghResults.value);
  }

  return allNews.slice(0, 15);
}
