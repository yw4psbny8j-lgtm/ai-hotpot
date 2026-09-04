/**
 * app.js - 主程序入口
 * 负责：初始化、事件绑定、历史管理、主分析流程
 */

import { normalizeHotspots, getAverageScore } from './utils.js';
import { fetchHackerNewsAI, fetchGitHubTrendingAI, fetchAllAINews } from './api.js';
import {
  elements,
  setStatus,
  renderEmptyState,
  setLoadingState,
  renderNewsList,
  renderHistoryList,
  renderSkillResult,
  summarizeHotspots
} from './ui.js';
import {
  SKILL_LABELS,
  buildOfflineSkillResult,
  analyzeWithAPI
} from './analysis.js';

/**
 * 示例文本
 */
const SAMPLE_TEXT = `2026 年全球 AI 产业持续扩张，企业重点关注 Agent 工作流、内容生成与数据治理。多家平台正在加速把自动化助手嵌入办公场景，尤其是研发、客服和运营团队。热点在于 AI 真实落地的 ROI、合规风险，以及对传统岗位结构的重构。资本市场更青睐具备高频使用场景的模型服务与垂直解决方案，而较大规模的基础模型公司则面临成本回收与市场分化的双重挑战。`;

/**
 * 存储键名
 */
const STORAGE_KEY = 'ai-hotpot-history-v1';

/**
 * 获取历史记录
 * @returns {Array} 历史记录数组
 */
function getHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

/**
 * 保存历史记录
 * @param {Array} history - 历史记录数组
 */
function saveHistory(history) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

/**
 * 更新统计数据
 */
function updateStats() {
  const history = getHistory();
  const total = history.length;
  const avg = total
    ? Math.round(history.reduce((sum, entry) => sum + (entry.averageScore || 0), 0) / total)
    : 0;

  elements.analysisCount.textContent = String(total);
  elements.avgScore.textContent = `${avg}%`;
}

/**
 * 持久化分析结果
 * @param {string} content - 输入内容
 * @param {string} skill - 技能类型
 * @param {object} result - 分析结果
 */
function persistAnalysis(content, skill, result) {
  const history = getHistory();
  const historyItem = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    content,
    skill,
    result,
    hotspots: Array.isArray(result?.hotspots)
      ? normalizeHotspots(result.hotspots)
      : Array.isArray(result?.risks)
        ? normalizeHotspots(result.risks)
        : Array.isArray(result?.competitors)
          ? normalizeHotspots(result.competitors)
          : normalizeHotspots(result || []),
    averageScore: getAverageScore(result?.hotspots || result?.risks || result?.competitors || result || []),
    summary: typeof result?.summary === 'string' ? result.summary : '',
    createdAt: new Date().toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  };

  history.push(historyItem);
  saveHistory(history.slice(-30));
  updateStats();
  renderHistoryList(history, elements, setStatus, renderSkillResult);
}

/**
 * 导出当前分析结果
 */
function exportCurrentResult() {
  const skill = elements.skillSelect.value;
  const payload = {
    exportedAt: new Date().toISOString(),
    skill,
    content: elements.content.value.trim(),
    summary: elements.summary.textContent,
    result: (() => {
      const resultNode = document.getElementById('hotspotList');
      if (!resultNode) return {};

      if (skill === 'risk_assessment') {
        return { risks: Array.from(resultNode.querySelectorAll('.risk-item')).map((item) => ({
          name: item.querySelector('.risk-name')?.textContent || '',
          probability: Number((item.querySelector('.risk-meta')?.textContent || '').match(/\d+/)?.[0] || 0),
          impact: (item.querySelector('.risk-meta')?.textContent || '').split('影响：')[1] || '中等',
          suggestion: item.querySelector('p')?.textContent || ''
        })) };
      }
      if (skill === 'competitor_analysis') {
        return { competitors: Array.from(resultNode.querySelectorAll('tbody tr')).map((row) => ({
          name: row.children[0]?.textContent || '',
          strength: row.children[1]?.textContent || '',
          weakness: row.children[2]?.textContent || '',
          positioning: row.children[3]?.textContent || ''
        })) };
      }
      if (skill === 'topic_summary') {
        return { summary: elements.summary.textContent };
      }
      return { hotspots: Array.from(resultNode.querySelectorAll('.hotspot-item')).map((item) => ({
        name: item.querySelector('.hotspot-name')?.textContent || '',
        score: Number(item.querySelector('.hotspot-score')?.dataset.score || 0),
        reason: item.querySelector('p')?.textContent || ''
      })) };
    })()
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ai-hotpot-${skill}-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  setStatus('JSON 导出成功。', true);
}

/**
 * 处理获取新闻
 */
async function handleFetchNews() {
  const source = elements.newsSource?.value || 'github_trending';
  const newsPanel = elements.newsPanel;
  const newsList = elements.newsList;

  if (!newsPanel || !newsList) return;

  newsPanel.style.display = 'block';
  newsList.innerHTML = '<div class="news-loading">正在获取 AI 新闻...</div>';
  if (elements.newsPanelTitle) {
    elements.newsPanelTitle.textContent = 'AI 新闻动态';
  }
  if (elements.newsCount) {
    elements.newsCount.textContent = '';
  }

  try {
    let news = [];

    if (source === 'github_trending') {
      news = await fetchGitHubTrendingAI();
      if (elements.newsPanelTitle) {
        elements.newsPanelTitle.textContent = 'GitHub Trending AI 项目';
      }
    } else if (source === 'hacker_news') {
      news = await fetchHackerNewsAI();
      if (elements.newsPanelTitle) {
        elements.newsPanelTitle.textContent = 'Hacker News AI 话题';
      }
    } else {
      news = await fetchAllAINews();
      if (elements.newsPanelTitle) {
        elements.newsPanelTitle.textContent = 'AI 新闻综合';
      }
    }

    renderNewsList(news, 'newsList');
    if (elements.newsCount) {
      elements.newsCount.textContent = `共 ${news.length} 条`;
    }
    if (!news.length) {
      setStatus('未获取到相关 AI 新闻。', false);
    }
  } catch (error) {
    newsList.innerHTML = `<div class="news-error">获取失败：${error.message || '未知错误'}<br>请稍后重试</div>`;
    setStatus('AI 新闻获取失败，请稍后重试。', false);
  }
}

/**
 * 主分析流程
 */
async function analyzeWithOpenRouter() {
  const apiKey = elements.apiKey.value.trim();
  const model = elements.model.value;
  const text = elements.content.value.trim();
  const skill = elements.skillSelect.value;

  if (!text) {
    setStatus('请先输入需要分析的内容。', false);
    renderEmptyState();
    return;
  }

  setLoadingState(true);

  const localResult = buildOfflineSkillResult(skill, text);

  if (!apiKey) {
    setTimeout(() => {
      renderSkillResult(localResult, skill);
      persistAnalysis(text, skill, localResult);
      setStatus('未配置 API Key，已切换到离线热点识别模式。', true);
      setLoadingState(false);
    }, 350);
    return;
  }

  setStatus(`正在调用 AI Code With 执行 ${SKILL_LABELS[skill]}...`, true);

  try {
    setStatus('正在连接 AI Code With...', true);
    const parsed = await analyzeWithAPI(apiKey, model, text, skill);
    const result = parsed || localResult;
    renderSkillResult(result, skill);
    persistAnalysis(text, skill, result);
    setStatus(`AI Code With ${SKILL_LABELS[skill]} 已完成。`, true);
  } catch (error) {
    console.error('AI Code With 调用失败:', error);
    renderSkillResult(localResult, skill);
    persistAnalysis(text, skill, localResult);
    setStatus(`AI 接口异常: ${error.message}。已回退到本地分析模式。`, false);
  } finally {
    setLoadingState(false);
  }
}

/**
 * 处理示例文本
 */
function handleSample() {
  elements.content.value = SAMPLE_TEXT;
  setStatus('已加载示例文本，您可以直接分析热点。', true);
}

/**
 * 处理清空
 */
function handleClear() {
  elements.content.value = '';
  renderEmptyState();
  setStatus('已清空输入。', true);
}

/**
 * 初始化历史记录
 */
function initHistory() {
  updateStats();
  const history = getHistory();
  renderHistoryList(history, elements, setStatus, renderSkillResult);
}

/**
 * 更新API提示显示
 */
function updateApiHint() {
  const apiKey = elements.apiKey?.value?.trim();
  if (elements.apiHint) {
    if (apiKey) {
      elements.apiHint.style.display = 'none';
    } else {
      elements.apiHint.style.display = 'flex';
    }
  }
}

// 监听 API Key 输入变化
elements.apiKey?.addEventListener('input', updateApiHint);

// 初始化时检查
updateApiHint();

// 绑定事件
elements.analyzeBtn.addEventListener('click', analyzeWithOpenRouter);
elements.exportBtn.addEventListener('click', exportCurrentResult);
elements.sampleBtn.addEventListener('click', handleSample);
elements.clearBtn.addEventListener('click', handleClear);
elements.fetchNewsBtn?.addEventListener('click', handleFetchNews);
elements.newsSource?.addEventListener('change', () => {
  elements.fetchNewsBtn?.click();
});

// 初始化
initHistory();
renderEmptyState();
