import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

const MODEL = 'deepseek-chat';

export async function parseResume(text) {
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [{
      role: 'user',
      content: `你是简历信息提取助手，读取用户简历全文，只提炼简历书面明确写出的有效内容，结构化输出JSON。
提取板块：
1. skills：个人掌握所有技能、工具、技术栈
2. experiences：实习/工作经历，每条保留工作内容、负责事项、落地动作
3. projects：项目经历，按以下结构拆分为独立条目：
   - name: 项目名称
   - duration: 项目时间（无则留空字符串）
   - tech_stack: 技术栈数组
   - responsibilities: 核心条目数组，每个条目包含：
     * label: 条目主题/小标题（如"项目简介"、"秒杀防超卖与一人一单"、"技术栈"等）
     * text: 该条目的具体内容

输出格式固定：
{
  "skills": [],
  "experiences": [],
  "projects": [{ "name": "", "duration": "", "tech_stack": [], "responsibilities": [{ "label": "", "text": "" }] }]
}

简历中项目经历的每个分条（如"项目简介"、"秒杀防超卖与一人一单"、"技术栈"、"缓存优化"等）都必须单独拆分为一条 responsibility，不得合并多条为一段。

输入简历：${text}`
    }]
  });
  try {
    const content = response.choices[0].message.content;
    const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(jsonStr);
  } catch {
    return { skills: [], experiences: [], projects: [], raw: response.choices[0].message.content };
  }
}