// 价值侧埋点工具
// 用于追踪匹配准确率、建议采纳率等业务指标

const ANALYTICS_KEY = 'resume_analytics_v1';

// 埋点数据结构
const metrics = {
  // 匹配反馈：用户标记匹配结果是否准确
  match_feedback: [],

  // 建议采纳：用户点击了哪条优化建议
  suggestion_adopt: [],

  // 建议查看：用户查看了建议面板
  suggestion_view: [],

  // 漏斗转化：简历上传、JD输入、分析触发
  funnel: [],

  // 用户评分：产品体验评分（1-5分）
  rating: [],
};

/**
 * 通用埋点方法
 * @param {string} event - 事件名称
 * @param {object} properties - 事件属性
 */
export function track(event, properties = {}) {
  const record = {
    event,
    timestamp: Date.now(),
    ...properties,
  };

  console.log('[Analytics]', event, properties);

  try {
    const raw = localStorage.getItem(ANALYTICS_KEY);
    const data = raw ? JSON.parse(raw) : { events: [] };
    data.events.push(record);

    // 限制本地存储事件数量（最多500条）
    if (data.events.length > 500) {
      data.events = data.events.slice(-500);
    }

    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[Analytics] Storage failed:', e);
  }
}

/**
 * 匹配准确反馈
 * @param {string} entryId - 分析记录ID
 * @param {string} type - 'skill' | 'scene'
 * @param {number} index - 第几条（0-based）
 * @param {boolean} isAccurate - 是否准确
 */
export function trackMatchFeedback(entryId, type, index, isAccurate) {
  track('match_feedback', {
    entry_id: entryId,
    skill_type: type,      // skill | scene
    item_index: index,
    is_accurate: isAccurate,
  });
}

/**
 * 建议采纳追踪
 * @param {string} entryId - 分析记录ID
 * @param {string} section - 'skill_bar' | 'project'
 * @param {number} index - 第几条建议
 */
export function trackSuggestionAdopt(entryId, section, index) {
  track('suggestion_adopt', {
    entry_id: entryId,
    section,               // skill_bar | project
    suggestion_index: index,
  });
}

/**
 * 建议查看追踪（用于计算采纳率分母）
 * @param {string} entryId - 分析记录ID
 * @param {number} viewDuration - 停留时长(ms)
 */
export function trackSuggestionView(entryId, viewDuration) {
  track('suggestion_view', {
    entry_id: entryId,
    view_duration_ms: viewDuration,
  });
}

/**
 * 分析漏斗追踪
 * @param {string} step - 'resume_upload' | 'jd_input' | 'analysis_start' | 'analysis_complete'
 * @param {object} data - 步骤相关数据
 */
export function trackFunnel(step, data = {}) {
  track('funnel', {
    step,
    ...data,
  });
}

/**
 * 用户评分
 * @param {string} entryId - 分析记录ID
 * @param {number} score - 评分（1-5）
 * @param {string} comment - 可选评论
 */
export function trackRating(entryId, score, comment = '') {
  track('rating', {
    entry_id: entryId,
    score,
    comment,
  });
}

/**
 * 获取所有埋点数据（用于调试或上报）
 */
export function getAnalyticsData() {
  try {
    const raw = localStorage.getItem(ANALYTICS_KEY);
    return raw ? JSON.parse(raw) : { events: [] };
  } catch {
    return { events: [] };
  }
}

/**
 * 清空埋点数据（测试用）
 */
export function clearAnalytics() {
  localStorage.removeItem(ANALYTICS_KEY);
}

/**
 * 计算采纳率
 * @returns {{ adoptCount, viewCount, rate }}
 */
export function calculateAdoptRate() {
  const data = getAnalyticsData();
  const events = data.events || [];

  const viewEvents = events.filter(e => e.event === 'suggestion_view');
  const adoptEvents = events.filter(e => e.event === 'suggestion_adopt');

  const viewCount = viewEvents.length;
  const adoptCount = adoptEvents.length;

  return {
    adoptCount,
    viewCount,
    rate: viewCount > 0 ? (adoptCount / viewCount * 100).toFixed(1) + '%' : '0%',
  };
}

/**
 * 计算匹配准确率
 * @returns {{ accurate, inaccurate, rate }}
 */
export function calculateMatchAccuracy() {
  const data = getAnalyticsData();
  const events = data.events || [];

  const feedbackEvents = events.filter(e => e.event === 'match_feedback');

  const accurate = feedbackEvents.filter(e => e.is_accurate === true).length;
  const inaccurate = feedbackEvents.filter(e => e.is_accurate === false).length;
  const total = accurate + inaccurate;

  return {
    accurate,
    inaccurate,
    total,
    rate: total > 0 ? (accurate / total * 100).toFixed(1) + '%' : '0%',
  };
}