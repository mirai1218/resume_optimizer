import express from 'express';
import { parseResume } from '../agents/resumeAgent.js';
import { parseJD } from '../agents/jdAgent.js';
import { calculateMatch } from '../agents/matchAgent.js';
import { generateSuggestions } from '../agents/suggestionAgent.js';

const router = express.Router();

router.post('/analyze', async (req, res) => {
  try {
    const { resumeText, jdText } = req.body;
    if (!resumeText || !jdText) {
      return res.status(400).json({ error: 'resumeText and jdText are required' });
    }

    // 前两个Agent并行
    const [resumeData, jdData] = await Promise.all([
      parseResume(resumeText),
      parseJD(jdText)
    ]);

    // 计算匹配度
    const matchResult = await calculateMatch(resumeData, jdData);

    // 生成建议
    const suggestions = await generateSuggestions(resumeData, jdData, matchResult, resumeText);

    res.json({ success: true, resumeData, jdData, matchResult, suggestions });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

export default router;