module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { resumeText, jdText } = req.body;
  if (!resumeText || !jdText) {
    return res.status(400).json({ error: 'resumeText and jdText are required' });
  }

  try {
    const { parseResume } = await import('../server/agents/resumeAgent.js');
    const { parseJD } = await import('../server/agents/jdAgent.js');
    const { calculateMatch } = await import('../server/agents/matchAgent.js');
    const { generateSuggestions } = await import('../server/agents/suggestionAgent.js');

    const [resumeResult, jdResult] = await Promise.all([
      parseResume(resumeText).catch(e => { throw Object.assign(e, { step: 'parseResume' }); }),
      parseJD(jdText).catch(e => { throw Object.assign(e, { step: 'parseJD' }); }),
    ]);

    // 适配 resumeAgent 返回格式（兼容新结构）
    const resumeData = {
      skills: resumeResult.skills || [],
      experiences: resumeResult.experiences || [],
      projects: resumeResult.projects || [],
      basic: resumeResult.basic || {}
    };

    // 适配 jdAgent 返回格式（兼容新结构）
    const jdData = {
      requirements: jdResult.requirements || { must: [], preferred: [], bonus_soft_skill: [] },
      responsibilities: jdResult.responsibilities || []
    };

    const matchResult = await calculateMatch(resumeData, jdData).catch(e => { throw Object.assign(e, { step: 'calculateMatch' }); });

    // 生成建议（suggestionAgent 返回 { content, status }）
    const suggestionResult = await generateSuggestions(resumeData, jdData, matchResult, resumeText).catch(e => { throw Object.assign(e, { step: 'generateSuggestions' }); });
    const suggestions = suggestionResult.content || '';

    return res.json({ success: true, resumeData, jdData, matchResult, suggestions });
  } catch (error) {
    console.error('Analysis error:', error);
    return res.status(500).json({
      error: 'Analysis failed',
      message: error.message,
      step: error.step || 'unknown',
    });
  }
};