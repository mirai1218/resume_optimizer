import React, { useState, useRef, useEffect } from 'react';
import { parseMarkdown } from '../utils/markdown.js';
import { useAnalytics } from '../hooks/useAnalytics.js';

const STATUS_ORDER = { '存在缺失': 0, '部分匹配': 1, '完全匹配': 2 };
const GROUP_META = {
  '完全匹配': { title: '完全匹配项', desc: '你已具备岗位要求的核心技能' },
  '部分匹配': { title: '部分匹配项', desc: '相关经历已具备，可优化表述突出优势' },
  '存在缺失': { title: '存在缺失项', desc: '简历中未体现，建议补充或调整' },
};

const groupByStatus = (arr) => {
  const sorted = [...(arr || [])].sort(
    (a, b) => (STATUS_ORDER[a.resume_status] ?? 3) - (STATUS_ORDER[b.resume_status] ?? 3)
  );
  const groups = [];
  for (const item of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.status === item.resume_status) {
      last.items.push(item);
    } else {
      groups.push({ status: item.resume_status, items: [item] });
    }
  }
  return groups;
};

export default function ResultView({ entry, profile, onNewAnalysis, onViewResume, onReanalyze, reanalyzing }) {
  const [collapseDiagnosis, setCollapseDiagnosis] = useState(true);
  const [collapseOverall, setCollapseOverall] = useState(true);
  const [collapseSuggestions, setCollapseSuggestions] = useState(true);
  const [collapseSkill, setCollapseSkill] = useState(false);
  const [collapseScene, setCollapseScene] = useState(false);

  // 评分状态
  const [userRating, setUserRating] = useState(null);
  const [hasRated, setHasRated] = useState(false);

  // DEBUG: 检查 reportMatchAccuracy 是否为函数
  const safeReport = useAnalytics(entry?.id);
  const reportMatchAccuracy = safeReport?.reportMatchAccuracy;
  const reportSuggestionView = safeReport?.reportSuggestionView;
  const reportRating = safeReport?.reportRating;

  console.log('[ResultView] reportMatchAccuracy:', typeof reportMatchAccuracy, entry?.id);

  const handleRating = (score) => {
    setUserRating(score);
    setHasRated(true);
    reportRating?.(score);
  };

  // 追踪建议面板展开
  const suggestionViewTimerRef = useRef(null);
  useEffect(() => {
    if (!collapseSuggestions) {
      suggestionViewTimerRef.current = Date.now();
    } else if (suggestionViewTimerRef.current) {
      const duration = Date.now() - suggestionViewTimerRef.current;
      reportSuggestionView?.(duration);
      suggestionViewTimerRef.current = null;
    }
  }, [collapseSuggestions, reportSuggestionView]);

  const togglePanel = (setter) => setter((v) => !v);

  // 防护：确保 fullResult 存在
  if (!entry?.fullResult) {
    return (
      <section className="result-section">
        <div className="result-panel">
          <div className="panel-body">
            <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              数据加载中或数据格式异常...
            </p>
          </div>
        </div>
      </section>
    );
  }

  const result = entry.fullResult;

  return (
    <section className="result-section">
      <div className="result-action-bar">
        <button className="result-action-btn" onClick={onNewAnalysis}>
          <span className="result-action-arrow">{'←'}</span>
          新增岗位描述
        </button>
        <div className="result-action-right">
          {profile && (
            <>
              <button className="view-resume-btn" onClick={() => onViewResume(profile)}>
                查看简历原文
              </button>
              {profile.fileUrl && (
                <button
                  className="view-file-btn"
                  onClick={() => window.open(profile.fileUrl, '_blank', 'noreferrer')}
                >
                  下载原文件
                </button>
              )}
            </>
          )}
          <button
            className="reanalyze-btn"
            onClick={() => onReanalyze(entry.jdText, entry.jdName)}
            disabled={reanalyzing}
          >
            {reanalyzing ? '优化中...' : '重新优化'}
          </button>
          {profile && (
            <span className="result-action-profile">当前简历：{profile.name}</span>
          )}
        </div>
      </div>

      <h2 className="section-title">分析结果</h2>

      <div className="result-panel">
        <div
          className="panel-header"
          onClick={() => togglePanel(setCollapseDiagnosis)}
          role="button"
          aria-expanded={!collapseDiagnosis}
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && togglePanel(setCollapseDiagnosis)}
        >
          <span className="panel-icon">▶</span>
          <span className="panel-title">岗位匹配诊断</span>
        </div>
        {!collapseDiagnosis && (
          <div className="panel-body">
            <div className="match-section">
              <h3
                className="match-section-title"
                onClick={() => setCollapseSkill((v) => !v)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setCollapseSkill((v) => !v)}
              >
                <span className={`match-section-arrow ${!collapseSkill ? 'expanded' : ''}`}>▶</span>
                硬技能对标
              </h3>
              {!collapseSkill && <div className="match-list">
                {groupByStatus(result.matchResult.skill_match).map((group) => (
                  <React.Fragment key={group.status}>
                    <div className="match-group-header">
                      <span className="match-group-title">{GROUP_META[group.status]?.title || group.status}</span>
                      <span className="match-group-desc">{GROUP_META[group.status]?.desc || ''}</span>
                    </div>
                    {group.items.map((item, i) => (
                      <div key={i} className={`match-item ${item.resume_status === '完全匹配' ? 'matched' : item.resume_status === '部分匹配' ? 'partial' : 'gap'}`}>
                        <div className="match-item-header">
                          <span className={`status-badge ${item.resume_status === '完全匹配' ? 'matched' : item.resume_status === '部分匹配' ? 'partial' : 'gap'}`}>
                            {item.resume_status}
                          </span>
                          <div className="match-feedback-btns">
                            <button
                              className="feedback-btn"
                              onClick={() => reportMatchAccuracy?.('skill', i, true)}
                              title="准确"
                            >✓</button>
                            <button
                              className="feedback-btn inaccurate"
                              onClick={() => reportMatchAccuracy?.('skill', i, false)}
                              title="不准确"
                            >✗</button>
                          </div>
                        </div>
                        <div className="match-item-demand">{item.job_demand}</div>
                        <div className="match-item-explain">{item.explain}</div>
                      </div>
                    ))}
                  </React.Fragment>
                ))}
              </div>
              }
            </div>
            <div className="match-section">
              <h3
                className="match-section-title"
                onClick={() => setCollapseScene((v) => !v)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setCollapseScene((v) => !v)}
              >
                <span className={`match-section-arrow ${!collapseScene ? 'expanded' : ''}`}>▶</span>
                工作场景对标
              </h3>
              {!collapseScene && <div className="match-list">
                {groupByStatus(result.matchResult.scene_match).map((group) => (
                  <React.Fragment key={group.status}>
                    <div className="match-group-header">
                      <span className="match-group-title">{GROUP_META[group.status]?.title || group.status}</span>
                      <span className="match-group-desc">{GROUP_META[group.status]?.desc || ''}</span>
                    </div>
                    {group.items.map((item, i) => (
                      <div key={i} className={`match-item ${item.resume_status === '完全匹配' ? 'matched' : item.resume_status === '部分匹配' ? 'partial' : 'gap'}`}>
                        <div className="match-item-header">
                          <span className={`status-badge ${item.resume_status === '完全匹配' ? 'matched' : item.resume_status === '部分匹配' ? 'partial' : 'gap'}`}>
                            {item.resume_status}
                          </span>
                          <div className="match-feedback-btns">
                            <button
                              className="feedback-btn"
                              onClick={() => reportMatchAccuracy?.('scene', i, true)}
                              title="准确"
                            >✓</button>
                            <button
                              className="feedback-btn inaccurate"
                              onClick={() => reportMatchAccuracy?.('scene', i, false)}
                              title="不准确"
                            >✗</button>
                          </div>
                        </div>
                        <div className="match-item-demand">{item.job_duty}</div>
                        <div className="match-item-explain">{item.explain}</div>
                      </div>
                    ))}
                  </React.Fragment>
                ))}
              </div>
              }
            </div>
          </div>
        )}
      </div>

      <div className="result-panel">
        <div
          className="panel-header"
          onClick={() => togglePanel(setCollapseOverall)}
          role="button"
          aria-expanded={!collapseOverall}
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && togglePanel(setCollapseOverall)}
        >
          <span className="panel-icon">▶</span>
          <span className="panel-title">整体匹配评价</span>
        </div>
        {!collapseOverall && (
          <div className="panel-body">
            {result.matchResult.overall_summary && (
              <div className="overall-summary">
                <h3 className="summary-title">综合评价</h3>
                <p>{result.matchResult.overall_summary}</p>
              </div>
            )}
            {result.matchResult.soft_skill_tips && (
              <div className="soft-skill-tips">
                <h3 className="summary-title">面试准备提示</h3>
                <p>{result.matchResult.soft_skill_tips}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="result-panel">
        <div
          className="panel-header"
          onClick={() => togglePanel(setCollapseSuggestions)}
          role="button"
          aria-expanded={!collapseSuggestions}
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && togglePanel(setCollapseSuggestions)}
        >
          <span className="panel-icon">▶</span>
          <span className="panel-title">简历优化建议</span>
        </div>
        {!collapseSuggestions && (
          <div className="panel-body">
            {result.suggestions && (
              <div className="suggestion-markdown" dangerouslySetInnerHTML={{ __html: parseMarkdown(result.suggestions) }} />
            )}
          </div>
        )}
      </div>

      {/* 用户评分 */}
      <div className="rating-section">
        <div className="rating-label">这次分析对你有帮助吗？</div>
        <div className="rating-stars">
          {[1, 2, 3, 4, 5].map((score) => (
            <button
              key={score}
              className={`rating-star ${userRating >= score ? 'active' : ''}`}
              onClick={() => handleRating(score)}
              disabled={hasRated}
            >
              ★
            </button>
          ))}
        </div>
        {hasRated && <div className="rating-thanks">感谢你的反馈！</div>}
      </div>
    </section>
  );
}
