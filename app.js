const SAMPLE_TEXT = `2026 年全球 AI 产业持续扩张，企业重点关注 Agent 工作流、内容生成与数据治理。多家平台正在加速把自动化助手嵌入办公场景，尤其是研发、客服和运营团队。热点在于 AI 真实落地的 ROI、合规风险，以及对传统岗位结构的重构。资本市场更青睐具备高频使用场景的模型服务与垂直解决方案，而较大规模的基础模型公司则面临成本回收与市场分化的双重挑战。`;

const stopWords = new Set([
  'the','a','an','and','or','but','if','then','else','for','with','from','into','onto','that','this','these','those','their','there','here','have','has','had','will','would','could','should','about','after','before','under','over','between','during','without','within','into','not','are','was','were','is','be','been','being','of','to','in','on','at','by','as','it','its','we','you','your','our','us','they','them','who','what','when','where','why','how','can','may','more','most','much','many','very','also','than','then','just','too','all','some','any','each','every','such','same','new','old','year','years','global','market','more','use','using','used','into','through','across','like','make','made','take','takes','taking','two','three','four','five','six','seven','eight','nine','ten','one','first','second','third','industry','companies','company','platform','platforms','team','teams'
]);

const STORAGE_KEY = 'ai-hotpot-history-v1';

const SKILL_LABELS = {
  hotspot_extraction: '热点提取',
  topic_summary: '话题摘要',
  risk_assessment: '风险评估',
  competitor_analysis: '竞品分析'
};

const elements = {
  apiKey: document.getElementById('apiKey'),
  model: document.getElementById('model'),
  content: document.getElementById('content'),
  skillSelect: document.getElementById('skillSelect'),
  analyzeBtn: document.getElementById('analyzeBtn'),
  exportBtn: document.getElementById('exportBtn'),
  sampleBtn: document.getElementById('sampleBtn'),
  clearBtn: document.getElementById('clearBtn'),
  newsSource: document.getElementById('newsSource'),
  fetchNewsBtn: document.getElementById('fetchNewsBtn'),
  newsPanel: document.getElementById('newsPanel'),
  newsList: document.getElementById('newsList'),
  newsCount: document.getElementById('newsCount'),
  newsPanelTitle: document.getElementById('newsPanelTitle'),
  status: document.getElementById('status'),
  apiHint: document.getElementById('apiHint'),
  hotspotList: document.getElementById('hotspotList'),
  summary: document.getElementById('summaryText'),
  progressWrap: document.querySelector('.progress-wrap'),
  progressBar: document.getElementById('progressBar'),
  historyList: document.getElementById('historyList'),
  analysisCount: document.getElementById('analysisCount'),
  avgScore: document.getElementById('avgScore')
};

function setStatus(message, isSuccess = true) {
  elements.status.textContent = message;
  elements.status.style.borderColor = isSuccess ? 'rgba(103, 232, 249, 0.18)' : 'rgba(244, 114, 182, 0.32)';
  elements.status.style.background = isSuccess ? 'rgba(103, 232, 249, 0.08)' : 'rgba(244, 114, 182, 0.08)';
}

function renderEmptyState() {
  elements.hotspotList.innerHTML = '<div class="empty-state">暂无热点数据，先输入内容再执行分析。</div>';
  elements.summary.textContent = '等待分析输入...';
}

function getHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? new Intl.NumberFormat('en-US').format(number) : '0';
}

const FALLBACK_GITHUB_NEWS = [
  { rank: 1, title: 'microsoft/ai', summary: '微软 AI 工作区与模型工程工具合集。', url: 'https://github.com/microsoft', source: 'GitHub', stars: 12000, language: '多语言' },
  { rank: 2, title: 'huggingface/transformers', summary: '大规模预训练模型与 NLP 工具生态。', url: 'https://github.com/huggingface/transformers', source: 'GitHub', stars: 115000, language: 'Python' },
  { rank: 3, title: 'openai/openai-cookbook', summary: 'OpenAI API 使用入门与高级例程。', url: 'https://github.com/openai/openai-cookbook', source: 'GitHub', stars: 60000, language: 'Jupyter' },
  { rank: 4, title: 'langchain-ai/langchain', summary: 'LLM 应用开发框架与 Agent 工作流。', url: 'https://github.com/langchain-ai/langchain', source: 'GitHub', stars: 87000, language: 'Python' },
  { rank: 5, title: 'microsoft/autogen', summary: '多智能体协作的自动化框架。', url: 'https://github.com/microsoft/autogen', source: 'GitHub', stars: 40000, language: 'Python' }
];

const FALLBACK_HN_NEWS = [
  { rank: 1, title: 'AI agents are becoming the new app layer', summary: '围绕 Agent 与工作流的讨论持续升温。', url: 'https://news.ycombinator.com/', source: 'Hacker News', score: 420, comments: 120 },
  { rank: 2, title: 'OpenAI launches stronger reasoning models for enterprise', summary: '企业部署与推理能力继续推动市场关注。', url: 'https://news.ycombinator.com/', source: 'Hacker News', score: 390, comments: 93 },
  { rank: 3, title: 'LLM evals are finally becoming a product category', summary: '模型评测、质量治理与反馈闭环受到重视。', url: 'https://news.ycombinator.com/', source: 'Hacker News', score: 330, comments: 77 }
];

function withTimeout(promiseFactory, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('请求超时，已回退到默认数据。')), timeoutMs);

    Promise.resolve()
      .then(promiseFactory)
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function fetchHackerNewsAI() {
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

      const aiKeywords = [
        'ai', 'llm', 'gpt', 'openai', 'anthropic', 'claude', 'gemini',
        'machine learning', 'deep learning', 'neural', 'transformer',
        'chatbot', 'artificial intelligence', 'copilot', 'diffusion',
        'stable diffusion', 'midjourney', 'langchain', 'rag'
      ];

      return stories
        .filter((story) => {
          if (!story || !story.title) return false;
          const title = story.title.toLowerCase();
          return aiKeywords.some((kw) => title.includes(kw));
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

async function fetchGitHubTrendingAI() {
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

async function fetchAllAINews() {
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

function renderNewsList(news, containerId = 'newsList') {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!news || news.length === 0) {
    container.innerHTML = '<div class="news-loading">暂无相关新闻</div>';
    return;
  }

  container.innerHTML = news.map((item, index) => `
    <div class="news-item" data-url="${encodeURI(item.url || '#')}" data-title="${escapeHtml(item.title || 'AI 新闻')}">
      <div class="news-item-row">
        <span class="news-rank ${index < 3 ? 'top3' : ''}">${item.rank}</span>
        <span class="news-title">${escapeHtml(item.title)}</span>
        <span class="news-source-tag ${item.source === 'GitHub' ? 'github' : 'hn'}">${item.source}</span>
      </div>
      ${item.summary ? `<div class="news-summary">${escapeHtml(item.summary)}</div>` : ''}
      <div class="news-meta">
        ${item.score ? `<span>👍 ${item.score}</span>` : ''}
        ${item.stars ? `<span>⭐ ${formatNumber(item.stars)}</span>` : ''}
        ${item.comments ? `<span>💬 ${item.comments}</span>` : ''}
        ${item.language ? `<span>📦 ${escapeHtml(item.language)}</span>` : ''}
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.news-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      const title = item.getAttribute('data-title');
      const url = item.getAttribute('data-url');
      
      // 如果按住 Ctrl/Command 点击，或者直接点击，在新窗口打开链接
      if (url && url !== '#') {
        window.open(url, '_blank', 'noopener,noreferrer');
        setStatus('已在新窗口打开新闻链接。', true);
      } else {
        // 如果没有链接，填入 textarea
        const textarea = document.getElementById('content');
        if (textarea) {
          textarea.value = title || textarea.value;
          textarea.dispatchEvent(new Event('input'));
        }
        setStatus('已填入相关新闻标题到输入区。', true);
      }
    });
  });
}

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

function getAverageScore(hotspots) {
  const items = normalizeHotspots(hotspots);
  if (!items.length) return 0;
  return Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length);
}

function updateStats() {
  const history = getHistory();
  const total = history.length;
  const avg = total
    ? Math.round(history.reduce((sum, entry) => sum + (entry.averageScore || 0), 0) / total)
    : 0;

  elements.analysisCount.textContent = String(total);
  elements.avgScore.textContent = `${avg}%`;
}

function renderHistoryList() {
  const history = getHistory();

  if (!history.length) {
    elements.historyList.innerHTML = '<div class="empty-state small">暂无历史分析。</div>';
    return;
  }

  elements.historyList.innerHTML = history
    .slice()
    .reverse()
    .map((entry) => {
      const label = SKILL_LABELS[entry.skill] || '热点分析';
      const preview = Array.isArray(entry.hotspots) && entry.hotspots.length
        ? entry.hotspots.slice(0, 2).map((item) => item.name || item.title || '热点').join(' · ')
        : (entry.summary ? String(entry.summary).slice(0, 18) : label);
      return `
        <div class="history-item" data-id="${entry.id}">
          <strong>${preview || label}</strong>
          <span>${entry.averageScore || 0}% · ${label} · ${entry.createdAt}</span>
        </div>
      `;
    })
    .join('');

  elements.historyList.querySelectorAll('.history-item').forEach((item) => {
    item.addEventListener('click', () => {
      const target = history.find((entry) => entry.id === item.dataset.id);
      if (!target) return;

      elements.content.value = target.content;
      elements.skillSelect.value = target.skill || 'hotspot_extraction';
      renderSkillResult(target.result || target.hotspots || [], target.skill || 'hotspot_extraction');
      setStatus(`已加载历史记录：${target.createdAt}`, true);
    });
  });
}

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
  renderHistoryList();
}

function setLoadingState(isLoading) {
  elements.analyzeBtn.disabled = isLoading;
  elements.analyzeBtn.classList.toggle('is-loading', isLoading);
  elements.progressWrap.classList.toggle('visible', isLoading);

  if (isLoading) {
    elements.analyzeBtn.textContent = '分析中...';
    elements.progressBar.style.width = '12%';
    let progress = 12;
    const timer = setInterval(() => {
      progress = Math.min(progress + Math.random() * 18 + 8, 92);
      elements.progressBar.style.width = `${progress}%`;
      if (!elements.analyzeBtn.disabled) {
        clearInterval(timer);
      }
    }, 200);
    elements.analyzeBtn.dataset.progressTimer = String(timer);
  } else {
    elements.analyzeBtn.textContent = '开始识别热点';
    elements.progressBar.style.width = '100%';
    setTimeout(() => {
      elements.progressBar.style.width = '0%';
      elements.progressWrap.classList.remove('visible');
    }, 250);
    if (elements.analyzeBtn.dataset.progressTimer) {
      clearInterval(Number(elements.analyzeBtn.dataset.progressTimer));
    }
  }
}

function normalizeHotspots(list) {
  const items = Array.isArray(list)
    ? list
    : Array.isArray(list?.hotspots)
      ? list.hotspots
      : Array.isArray(list?.items)
        ? list.items
        : Array.isArray(list?.list)
          ? list.list
          : [];

  return items
    .map((item) => ({
      name: String(item?.name || item?.title || '').trim(),
      score: Number(item?.score || item?.probability || 0),
      reason: String(item?.reason || item?.suggestion || item?.impact || '关注这一主题的增长趋势与落地场景。')
    }))
    .filter((item) => item.name && item.score > 0)
    .slice(0, 5);
}

function extractLocalHotspots(text) {
  const wordMap = new Map();
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];

  for (const word of words) {
    if (word.length < 3 || stopWords.has(word)) continue;
    wordMap.set(word, (wordMap.get(word) || 0) + 1);
  }

  const sorted = [...wordMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count], index) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      score: Math.min(96, 55 + count * 12 + index * 3),
      reason: `该主题在文本中出现 ${count} 次，显示出明显的关注度和行动信号。`
    }));

  if (!sorted.length) {
    return [{
      name: '趋势观察',
      score: 81,
      reason: '文本内容较短，建议补充更多背景信息后再做更细化的热点识别。'
    }];
  }

  return sorted;
}

function animateScoreCounter(element, target) {
  const duration = 700;
  const startTime = performance.now();

  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(target * eased);
    element.textContent = `${current}%`;

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      element.textContent = `${target}%`;
    }
  }

  requestAnimationFrame(tick);
}

function renderHotspots(hotspots) {
  const items = normalizeHotspots(hotspots);

  if (!items.length) {
    renderEmptyState();
    return;
  }

  const html = items.map((item, index) => `
    <div class="hotspot-item" style="--delay:${index * 120}ms">
      <div class="hotspot-head">
        <div style="display:flex;align-items:center;gap:12px;">
          <span class="hotspot-tag">${index + 1}</span>
          <span class="hotspot-name">${item.name}</span>
        </div>
        <span class="hotspot-score" data-score="${Math.round(item.score)}">0%</span>
      </div>
      <p>${item.reason}</p>
    </div>
  `).join('');

  elements.hotspotList.innerHTML = html;

  const scoreNodes = document.querySelectorAll('.hotspot-score');
  scoreNodes.forEach((node) => {
    const target = Number(node.dataset.score || 0);
    node.textContent = '0%';
    animateScoreCounter(node, target);
  });
}

function renderSummaryCard(summaryText) {
  elements.hotspotList.innerHTML = `
    <div class="skill-summary">
      <p>${summaryText}</p>
    </div>
  `;
}

function renderRiskCard(risks) {
  const list = Array.isArray(risks) ? risks : [];
  if (!list.length) {
    renderEmptyState();
    return;
  }

  elements.hotspotList.innerHTML = `
    <div class="risk-list">
      ${list.map((risk) => {
        const probability = Number(risk.probability ?? risk.score ?? 0);
        const level = probability >= 70 ? 'high' : probability >= 40 ? 'medium' : 'low';
        const label = risk.level || level;
        const name = risk.name || risk.title || '风险项';
        const suggestion = risk.suggestion || risk.recommendation || '建议加强监测和预案准备。';
        return `
          <div class="risk-item ${level}">
            <div class="risk-header">
              <span class="risk-name">${name}</span>
              <span class="risk-badge ${level}">${label}</span>
            </div>
            <div class="risk-meta">概率：${probability}% · 影响：${risk.impact || '中等'}</div>
            <p>${suggestion}</p>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderCompetitorCard(competitors) {
  const list = Array.isArray(competitors) ? competitors : [];
  if (!list.length) {
    renderEmptyState();
    return;
  }

  elements.hotspotList.innerHTML = `
    <table class="compare-table">
      <thead>
        <tr>
          <th>竞品</th>
          <th>优势</th>
          <th>短板</th>
          <th>定位</th>
        </tr>
      </thead>
      <tbody>
        ${list.map((item) => `
          <tr>
            <td class="cell-strong">${item.name || item.company || '竞品'}</td>
            <td>${item.strength || item.advantage || '未提供'}</td>
            <td>${item.weakness || item.shortcoming || '未提供'}</td>
            <td>${item.positioning || item.strategy || '未提供'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderSkillResult(data, skill) {
  const result = data && typeof data === 'object' ? data : {};

  switch (skill) {
    case 'topic_summary': {
      const text = result.summary || result.text || result.output || '摘要生成成功。';
      renderSummaryCard(String(text));
      elements.summary.textContent = String(text);
      break;
    }
    case 'risk_assessment': {
      const risks = result.risks || result.items || result.list || [];
      renderRiskCard(risks);
      elements.summary.textContent = result.summary || '风险评估已生成。';
      break;
    }
    case 'competitor_analysis': {
      const competitors = result.competitors || result.items || result.rows || [];
      renderCompetitorCard(competitors);
      elements.summary.textContent = result.summary || '竞品分析已完成。';
      break;
    }
    case 'hotspot_extraction':
    default: {
      const hotspots = result.hotspots || result.items || result.list || data || [];
      renderHotspots(hotspots);
      summarizeHotspots(hotspots);
    }
  }
}

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

function summarizeHotspots(hotspots) {
  const items = normalizeHotspots(hotspots);
  if (!items.length) {
    elements.summary.textContent = '尚未生成结果，请先输入文本并执行分析。';
    return;
  }

  const topNames = items.slice(0, 3).map((item) => item.name).join('、');
  const average = Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length);
  elements.summary.textContent = `当前最强热点集中在 ${topNames}，整体关注强度约 ${average}%，说明内容中最值得关注的演进信号已形成明显聚焦。`;
}

function parseJsonObject(rawText) {
  const cleaned = String(rawText || '').replace(/```json|```/gi, '').trim();
  if (!cleaned) return null;

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (error) {
    // Try extracting JSON object from the message.
  }

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsedMatch = JSON.parse(match[0]);
      if (parsedMatch && typeof parsedMatch === 'object') return parsedMatch;
    } catch (error) {
      // Ignore.
    }
  }

  return null;
}

function getSkillPrompt(skill, text) {
  const prompts = {
    hotspot_extraction: {
      system: '你是一名热点分析助手。请从用户文本中提取 3~5 个最重要的热点主题。返回严格 JSON 对象：{"hotspots":[{"name":"...","score":0-100,"reason":"..."}]}。只返回 JSON。',
      user: `请分析下面文本，输出热点提取结果：\n\n${text}`
    },
    topic_summary: {
      system: '你是一名内容总结助手。请基于用户输入内容，输出一段简洁但全面的中文总结。返回严格 JSON 对象：{"summary":"..."}。只返回 JSON。',
      user: `请总结下面文本：\n\n${text}`
    },
    risk_assessment: {
      system: '你是一名风险评估助手。请从文本中识别 3~5 项主要风险，并给出概率、影响程度和建议。返回严格 JSON 对象：{"risks":[{"name":"...","probability":0-100,"impact":"高/中/低","suggestion":"..."}]}。只返回 JSON。',
      user: `请评估下面文本的风险：\n\n${text}`
    },
    competitor_analysis: {
      system: '你是一名竞品分析助手。请从文本中归纳 3~4 个关键竞品或参考对象，并给出优势、短板和定位。返回严格 JSON 对象：{"competitors":[{"name":"...","strength":"...","weakness":"...","positioning":"..."}]}。只返回 JSON。',
      user: `请做竞品分析：\n\n${text}`
    }
  };

  return prompts[skill] || prompts.hotspot_extraction;
}

function buildOfflineSkillResult(skill, text) {
  switch (skill) {
    case 'topic_summary':
      return {
        summary: text.length > 220 ? `${text.slice(0, 220)}...` : text
      };
    case 'risk_assessment':
      return {
        risks: [
          { name: 'AI 合规与治理风险', probability: 76, impact: '高', suggestion: '建立模型使用白名单和审计流程，降低不当输出和滥用风险。' },
          { name: '落地 ROI 压力', probability: 68, impact: '高', suggestion: '聚焦高频场景，优先验证真实业务收益与成本回收路径。' },
          { name: '组织变革管理风险', probability: 52, impact: '中', suggestion: '同步培训业务团队并设计岗位过渡方案，降低实施阻力。' }
        ]
      };
    case 'competitor_analysis':
      return {
        competitors: [
          { name: '平台 A', strength: '大模型能力成熟，生态覆盖广', weakness: '行业场景定制不足', positioning: '做通用能力平台' },
          { name: '平台 B', strength: '垂直场景落地强', weakness: '扩展能力较有限', positioning: '服务特定行业' },
          { name: '平台 C', strength: '运营效率和内容生成突出', weakness: '数据治理与合规能力偏弱', positioning: '做内容生产工具' }
        ]
      };
    case 'hotspot_extraction':
    default:
      return { hotspots: extractLocalHotspots(text) };
  }
}

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

  // 调试信息
  console.log('API Key 长度:', apiKey.length);
  console.log('选择的模型:', model);
  
  // 清理 API Key，只移除前后空格和不可见字符
  const cleanApiKey = apiKey.trim().replace(/[\s\x00-\x1F\x7F]/g, '');
  console.log('清理后的 API Key 长度:', cleanApiKey.length);
  console.log('API Key 前6位:', cleanApiKey.substring(0, 6) + '...');
  
  const skillPrompt = getSkillPrompt(skill, text);
  setStatus(`正在调用 AI Code With 执行 ${SKILL_LABELS[skill]}...`, true);

  try {
    setStatus('正在连接 AI Code With...', true);
    
    // 构建请求
    const requestBody = JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: skillPrompt.system },
        { role: 'user', content: skillPrompt.user }
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' }
    });
    
    console.log('请求 URL:', 'https://api.aicodewith.ai/v1/chat/completions');
    console.log('请求模型:', model);
    console.log('Authorization:', `Bearer ${cleanApiKey.substring(0, 10)}...`);
    
    const response = await fetch('https://api.aicodewith.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cleanApiKey}`
      },
      body: requestBody
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '无法获取错误详情');
      throw new Error(`API 错误 (${response.status}): ${errorText}`);
    }

    setStatus('正在处理 AI 响应...', true);
    const result = await response.json();
    const content = result?.choices?.[0]?.message?.content || '';
    
    if (!content) {
      throw new Error('AI 返回了空内容');
    }
    
    const parsed = parseJsonObject(content) || localResult;
    renderSkillResult(parsed, skill);
    persistAnalysis(text, skill, parsed);
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

function handleSample() {
  elements.content.value = SAMPLE_TEXT;
  setStatus('已加载示例文本，您可以直接分析热点。', true);
}

function handleClear() {
  elements.content.value = '';
  renderEmptyState();
  setStatus('已清空输入。', true);
}

function initHistory() {
  updateStats();
  renderHistoryList();
}

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

elements.analyzeBtn.addEventListener('click', analyzeWithOpenRouter);
elements.exportBtn.addEventListener('click', exportCurrentResult);
elements.sampleBtn.addEventListener('click', handleSample);
elements.clearBtn.addEventListener('click', handleClear);
elements.fetchNewsBtn?.addEventListener('click', handleFetchNews);
elements.newsSource?.addEventListener('change', () => {
  elements.fetchNewsBtn?.click();
});

initHistory();
renderEmptyState();
