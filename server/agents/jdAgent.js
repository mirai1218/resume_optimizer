import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

const MODEL = 'deepseek-chat';

export async function parseJD(text) {
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [{
      role: 'user',
      content: `你是专业岗位解析助手，请解析用户传入的招聘JD文本，严格拆分两大板块内容，统一输出标准JSON格式，禁止多余文字。
拆分规则：
1. requirements：任职硬要求，分为三类
   - must：必选硬性门槛（学历、专业、核心必备技能、工作年限）
   - preferred：优先加分技能（加分工具、辅助能力）
   - bonus：额外优势条件
2. responsibilities：岗位职责，提炼3-6条日常核心工作场景，简洁短句描述

输出格式固定：
{
  "requirements": {
    "must": [],
    "preferred": [],
    "bonus": []
  },
  "responsibilities": []
}

输入JD：${text}`
    }]
  });
  try {
    const content = response.choices[0].message.content;
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr);
  } catch {
    return { requirements: { must: [], preferred: [], bonus: [] }, responsibilities: [], raw: response.choices[0].message.content };
  }
}