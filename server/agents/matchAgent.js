import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

const MODEL = 'deepseek-chat';

export async function calculateMatch(resumeData, jdData) {
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [{
      role: 'user',
      content: `你是简历岗位匹配分析师，结合解析后的简历信息、岗位任职要求、岗位职责，从两个维度做对标匹配，**不输出任何数字分数**，只判定匹配状态+说明原因。

判定通用规则：
1. 技能栏与项目内容分开评判：技能对标仅对比技能栏填写内容；项目经历中出现的算法、技术框架、自研工具等，不纳入技能栏冗余评判范围，不建议删除
2. 同类型工具统一标准：功能用途一致的工具或平台，采用相同评判尺度，不区别对待、不偏心删减
3. 不删减真实掌握的内容：简历技能栏中列出的技术，是求职者真实掌握并主动呈现的，不随意判定为冗余或建议删除
4. 仅围绕当前招聘岗位方向判断适配度，不超出岗位需求范围进行评判

匹配维度：
维度1：硬技能对标 → 对照任职要求，判定技能栏内容满足情况
维度2：工作场景对标 → 对照岗位职责，判断简历经历是否贴合岗位日常工作

状态仅分为三种：完全匹配、部分匹配、存在缺失
每条匹配内容附带简短原因说明，最后汇总整体匹配结论与核心短板。

输出固定JSON格式：
{
  "skill_match": [
    {
      "job_demand": "岗位要求内容",
      "resume_status": "完全匹配/部分匹配/存在缺失",
      "explain": "匹配原因简述"
    }
  ],
  "scene_match": [
    {
      "job_duty": "岗位工作职责",
      "resume_status": "完全匹配/部分匹配/存在缺失",
      "explain": "匹配原因简述"
    }
  ],
  "overall_summary": "整体匹配概括，点明简历优势与主要欠缺的工作场景"
}

传入数据：
简历信息：${JSON.stringify(resumeData, null, 2)}
岗位要求：${JSON.stringify(jdData.requirements, null, 2)}
岗位职责：${JSON.stringify(jdData.responsibilities, null, 2)}`
    }]
  });
  try {
    const content = response.choices[0].message.content;
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr);
  } catch {
    return { skill_match: [], scene_match: [], overall_summary: '解析失败' };
  }
}