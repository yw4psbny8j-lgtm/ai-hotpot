/**
 * utils.js - 工具函数模块
 * 包含：HTML转义、数字格式化、JSON解析、超时控制、数据标准化
 */

/**
 * 转义HTML特殊字符，防止XSS攻击
 * @param {*} value - 需要转义的值
 * @returns {string} 转义后的字符串
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 格式化数字，添加千位分隔符
 * @param {number|string} value - 需要格式化的数字
 * @returns {string} 格式化后的字符串
 */
export function formatNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? new Intl.NumberFormat('en-US').format(number) : '0';
}

/**
 * 解析JSON对象，支持从Markdown代码块中提取
 * @param {string} rawText - 原始文本
 * @returns {object|null} 解析后的对象，失败返回null
 */
export function parseJsonObject(rawText) {
  const cleaned = String(rawText || '').replace(/```json|```/gi, '').trim();
  if (!cleaned) return null;

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch (error) {
    // 尝试从文本中提取JSON对象
  }

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const parsedMatch = JSON.parse(match[0]);
      if (parsedMatch && typeof parsedMatch === 'object') return parsedMatch;
    } catch (error) {
      // 忽略解析错误
    }
  }

  return null;
}

/**
 * 为Promise添加超时控制
 * @param {Function} promiseFactory - 返回Promise的工厂函数
 * @param {number} timeoutMs - 超时时间（毫秒）
 * @returns {Promise} 带超时控制的Promise
 */
export function withTimeout(promiseFactory, timeoutMs = 6000) {
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

/**
 * 标准化热点数据格式
 * @param {Array|object} list - 热点数据列表
 * @returns {Array} 标准化后的热点数组
 */
export function normalizeHotspots(list) {
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

/**
 * 计算热点平均分数
 * @param {Array} hotspots - 热点数组
 * @returns {number} 平均分数（0-100）
 */
export function getAverageScore(hotspots) {
  const items = normalizeHotspots(hotspots);
  if (!items.length) return 0;
  return Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length);
}
