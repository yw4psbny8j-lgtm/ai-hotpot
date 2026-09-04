/**
 * ui.js - 界面渲染模块
 * 包含：状态管理、DOM操作、动画、渲染函数
 */

import { escapeHtml, formatNumber, normalizeHotspots } from './utils.js';

/**
 * DOM元素引用
 */
export const elements = {
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

/**
 * 设置状态信息
 * @param {string} message - 状态消息
 * @param {boolean} isSuccess - 是否成功
 */
export function setStatus(message, isSuccess = true) {
  elements.status.textContent = message;
  elements.status.style.borderColor = isSuccess ? 'rgba(103, 232, 249, 0.18)' : 'rgba(244, 114, 182, 0.32)';
  elements.status.style.background = isSuccess ? 'rgba(103, 232, 249, 0.08)' : 'rgba(244, 114, 182, 0.08)';
}

/**
 * 渲染空状态
 */
export function renderEmptyState() {
  elements.hotspotList.innerHTML = '<div class="empty-state">暂无热点数据，先输入内容再执行分析。</div>';
  elements.summary.textContent = '等待分析输入...';
}

/**
 * 设置加载状态
 * @param {boolean} isLoading - 是否加载中
 */
export function setLoadingState(isLoading) {
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

/**
 * 分数计数器动画
 * @param {HTMLElement} element - 目标元素
 * @param {number} target - 目标分数
 */
export function animateScoreCounter(element, target) {
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

/**
 * 渲染热点列表
 * @param {Array} hotspots - 热点数据
 */
export function renderHotspots(hotspots) {
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

/**
 * 渲染摘要卡片
 * @param {string} summaryText - 摘要文本
 */
export function renderSummaryCard(summaryText) {
  elements.hotspotList.innerHTML = `
    <div class="skill-summary">
      <p>${summaryText}</p>
    </div>
  `;
}

/**
 * 渲染风险卡片
 * @param {Array} risks - 风险数据
 */
export function renderRiskCard(risks) {
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

/**
 * 渲染竞品分析卡片
 * @param {Array} competitors - 竞品数据
 */
export function renderCompetitorCard(competitors) {
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

/**
 * 渲染技能结果
 * @param {object} data - 结果数据
 * @param {string} skill - 技能类型
 */
export function renderSkillResult(data, skill) {
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

/**
 * 渲染新闻列表
 * @param {Array} news - 新闻数据
 * @param {string} containerId - 容器ID
 */
export function renderNewsList(news, containerId = 'newsList') {
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
      
      if (url && url !== '#') {
        window.open(url, '_blank', 'noopener,noreferrer');
        setStatus('已在新窗口打开新闻链接。', true);
      } else {
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

/**
 * 渲染历史记录列表
 * @param {Array} history - 历史记录
 * @param {object} elements - DOM元素引用
 * @param {Function} setStatus - 状态设置函数
 * @param {Function} renderSkillResult - 渲染结果函数
 */
export function renderHistoryList(history, elements, setStatus, renderSkillResult) {
  if (!history.length) {
    elements.historyList.innerHTML = '<div class="empty-state small">暂无历史分析。</div>';
    return;
  }

  const SKILL_LABELS = {
    hotspot_extraction: '热点提取',
    topic_summary: '话题摘要',
    risk_assessment: '风险评估',
    competitor_analysis: '竞品分析'
  };

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

/**
 * 生成热点摘要
 * @param {Array} hotspots - 热点数据
 */
export function summarizeHotspots(hotspots) {
  const items = normalizeHotspots(hotspots);
  if (!items.length) {
    elements.summary.textContent = '尚未生成结果，请先输入文本并执行分析。';
    return;
  }

  const topNames = items.slice(0, 3).map((item) => item.name).join('、');
  const average = Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length);
  elements.summary.textContent = `当前最强热点集中在 ${topNames}，整体关注强度约 ${average}%，说明内容中最值得关注的演进信号已形成明显聚焦。`;
}
