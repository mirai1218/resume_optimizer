import { parseResume } from '../server/agents/resumeAgent.js';
import { parseJD } from '../server/agents/jdAgent.js';
import { calculateMatch } from '../server/agents/matchAgent.js';
import { generateSuggestions } from '../server/agents/suggestionAgent.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { resumeText, jdText } = req.body;
  if (!resumeText || !jdText) {
    return res.status(400).json({ error: 'resumeText and jdText are required' });
  }

  try {
    const [resumeData, jdData] = await Promise.all([
      parseResume(resumeText),
      parseJD(jdText),
    ]);

    const matchResult = await calculateMatch(resumeData, jdData);
    const suggestions = await generateSuggestions(resumeData, jdData, matchResult, resumeText);

    return res.json({ success: true, resumeData, jdData, matchResult, suggestions });
  } catch (error) {
    console.error('Analysis error:', error);
    return res.status(500).json({ error: 'Analysis failed' });
  }
}
