/**
 * analysis.js - 分析逻辑模块
 * 包含：API调用、本地分析、提示词生成
 */

import { parseJsonObject } from './utils.js';

/**
 * 停用词集合
 */
const stopWords = new Set([
  'the','a','an','and','or','but','if','then','else','for','with','from','into','onto','that','this','these','those','their','there','here','have','has','had','will','would','could','should','about','after','before','under','over','between','during','without','within','into','not','are','was','were','is','be','been','being','of','to','in','on','at','by','as','it','its','we','you','your','our','us','they','them','who','what','when','where','why','how','can','may','more','most','much','many','very','also','than','then','just','too','all','some','any','each','every','such','same','new','old','year','years','global','market','more','use','using','used','into','through','across','like','make','made','take','takes','taking','two','three','four','five','six','seven','eight','nine','ten','one','first','second','third','industry','companies','company','platform','platforms','team','teams'
]);

/**
 * 技能标签
 */
export const SKILL_LABELS = {
  hotspot_extraction: '热点提取',
  topic_summary: '话题摘要',
  risk_assessment: '风险评估',
  competitor_analysis: '竞品分析'
};

/**
 * 获取技能提示词
 * @param {string} skill - 技能类型
 * @param {string} text - 输入文本
 * @returns {object} 系统提示和用户提示
 */
export function getSkillPrompt(skill, text) {
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

/**
 * 本地提取热点（简单词频统计）
 * @param {string} text - 输入文本
 * @returns {Array} 热点列表
 */
export function extractLocalHotspots(text) {
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

/**
 * 构建离线分析结果
 * @param {string} skill - 技能类型
 * @param {string} text - 输入文本
 * @returns {object} 分析结果
 */
export function buildOfflineSkillResult(skill, text) {
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

/**
 * 使用AI Code With API进行分析
 * @param {string} apiKey - API密钥
 * @param {string} model - 模型名称
 * @param {string} text - 输入文本
 * @param {string} skill - 技能类型
 * @returns {Promise<object>} 分析结果
 */
export async function analyzeWithAPI(apiKey, model, text, skill) {
  const cleanApiKey = apiKey.trim().replace(/[\s\x00-\x1F\x7F]/g, '');
  const skillPrompt = getSkillPrompt(skill, text);

  const requestBody = JSON.stringify({
    model: model,
    messages: [
      { role: 'system', content: skillPrompt.system },
      { role: 'user', content: skillPrompt.user }
    ],
    temperature: 0.4,
    response_format: { type: 'json_object' }
  });

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

  const result = await response.json();
  const content = result?.choices?.[0]?.message?.content || '';

  if (!content) {
    throw new Error('AI 返回了空内容');
  }

  const parsed = parseJsonObject(content);
  return parsed;
}
