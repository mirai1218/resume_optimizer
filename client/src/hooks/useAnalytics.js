import { useCallback } from 'react';
import {
  track,
  trackMatchFeedback,
  trackSuggestionAdopt,
  trackSuggestionView,
  trackFunnel,
  trackRating,
  calculateAdoptRate,
  calculateMatchAccuracy,
  getAnalyticsData,
} from '../utils/analytics.js';

export function useAnalytics(entryId) {
  // 匹配反馈
  const reportMatchAccuracy = useCallback((type, index, isAccurate) => {
    trackMatchFeedback(entryId, type, index, isAccurate);
  }, [entryId]);

  // 建议采纳
  const reportSuggestionAdopt = useCallback((section, index) => {
    trackSuggestionAdopt(entryId, section, index);
  }, [entryId]);

  // 建议查看
  const reportSuggestionView = useCallback((viewDuration) => {
    trackSuggestionView(entryId, viewDuration);
  }, [entryId]);

  // 漏斗追踪
  const reportFunnel = useCallback((step, data) => {
    trackFunnel(step, { entry_id: entryId, ...data });
  }, [entryId]);

  // 用户评分
  const reportRating = useCallback((score, comment) => {
    trackRating(entryId, score, comment);
  }, [entryId]);

  // 获取采纳率
  const getAdoptRate = useCallback(() => {
    return calculateAdoptRate();
  }, []);

  // 获取匹配准确率
  const getMatchAccuracy = useCallback(() => {
    return calculateMatchAccuracy();
  }, []);

  return {
    reportMatchAccuracy,
    reportSuggestionAdopt,
    reportSuggestionView,
    reportFunnel,
    reportRating,
    getAdoptRate,
    getMatchAccuracy,
  };
}