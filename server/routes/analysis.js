import express from 'express';
import { parseResume } from '../agents/resumeAgent.js';
import { parseJD } from '../agents/jdAgent.js';
import { calculateMatch } from '../agents/matchAgent.js';
import { generateSuggestions } from '../agents/suggestionAgent.js';
import logger from '../utils/logger.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const { resumeText, jdText } = req.body;
    if (!resumeText || !jdText) {
      return res.status(400).json({ error: 'resumeText and jdText are required' });
    }

    // 前两个Agent并行
    const [resumeResult, jdResult] = await Promise.all([
      parseResume(resumeText),
      parseJD(jdText)
    ]);

    const parseDuration = Date.now() - startTime;

    if (resumeResult.status === 'error') {
      logger.error({ requestId, duration_ms: parseDuration, error_type: 'resume_parse_error', message: resumeResult.raw }, 'Resume parsing failed');
    }
    if (jdResult.status === 'error') {
      logger.error({ requestId, duration_ms: parseDuration, error_type: 'jd_parse_error', message: jdResult.raw }, 'JD parsing failed');
    }

    // 适配 resumeAgent 返回格式（兼容新结构）
    const resumeData = {
      skills: resumeResult.skills || [],
      skills_section: resumeResult.skills_section || '',
      experiences: resumeResult.experiences || [],
      projects: resumeResult.projects || [],
      basic: resumeResult.basic || {}
    };

    // 适配 jdAgent 返回格式（兼容新结构）
    const jdData = {
      requirements: jdResult.requirements || { must: [], preferred: [], bonus_soft_skill: [] },
      responsibilities: jdResult.responsibilities || []
    };

    // 计算匹配度
    const matchStart = Date.now();
    const matchResult = await calculateMatch(resumeData, jdData);
    const matchDuration = Date.now() - matchStart;

    if (matchResult.status === 'error') {
      logger.error({ requestId, duration_ms: matchDuration, error_type: 'match_error', message: matchResult.raw }, 'Match calculation failed');
    }

    // 生成建议（suggestionAgent 返回 { content, status }）
    const suggestionStart = Date.now();
    const suggestionResult = await generateSuggestions(resumeData, jdData, matchResult, resumeText);
    const suggestionDuration = Date.now() - suggestionStart;

    const suggestions = suggestionResult.content || '';
    const totalDuration = Date.now() - startTime;

    logger.info({
      requestId,
      duration_ms: totalDuration,
      parse_duration_ms: parseDuration,
      match_duration_ms: matchDuration,
      suggestion_duration_ms: suggestionDuration,
      success: true
    }, 'Analysis completed');

    res.json({ success: true, resumeData, jdData, matchResult, suggestions });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error({ requestId, duration_ms: duration, error_type: 'unknown', message: error.message }, 'Analysis error');
    res.status(500).json({ error: 'Analysis failed' });
  }
});

export default router;