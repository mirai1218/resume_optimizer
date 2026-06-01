import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// ==================== 配置化管理（便于维护/切换模型） ====================
const AI_CONFIG = {
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.minimaxi.com/anthropic',
  model: 'MiniMax-M2.7',
  temperature: 0.1,
  maxTokens: 8000,
};

// 初始化客户端
const client = new OpenAI({
  apiKey: AI_CONFIG.apiKey,
  baseURL: AI_CONFIG.baseURL,
});

// ==================== 工具函数：数据清洗（JD匹配必备） ====================
/**
 * 数组去重 + 空值过滤
 */
const uniqueArray = (arr) => [...new Set(arr.filter(Boolean))];

/**
 * 强化清洗模型返回的JSON字符串（兼容所有格式）
 */
const cleanJsonString = (str) => {
  return str
    .replace(/```(json)?\n?/gi, '') // 移除所有markdown代码块
    .replace(/```/g, '')
    .replace(/[\n\r\t]/g, ' ')      // 移除换行/制表符，转为空格
    .replace(/\\n/g, ' ')           // 移除转义换行符
    .replace(/\\u00a0/g, ' ')      // 移除不间断空格
    .replace(/,\s*}/g, '}')         // 移除尾随逗号
    .replace(/,\s*]/g, ']')
    .trim();
};

// ==================== 核心解析函数 ====================
export async function parseResume(text) {
  // 1. 输入校验
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return {
      basic: { education: '', work_years: '', job_type: '' },
      skills: [],
      experiences: [],
      projects: [],
      raw: '输入简历文本为空',
      status: 'error'
    };
  }

  try {
    const response = await client.chat.completions.create({
      model: AI_CONFIG.model,
      temperature: AI_CONFIG.temperature,
      max_tokens: AI_CONFIG.maxTokens,
      messages: [{
        role: 'user',
        content: `
# 角色：简历信息提取专家（零幻觉、仅提取原文显性内容）
# 强制核心规则（必须严格遵守）
1. 绝对禁止编造、脑补、推测任何信息！简历中没有的内容统一返回空字符串 "" 或空数组 []，严禁使用 null
2. 项目经历中每一个独立小标题/分段内容，必须单独拆分为一条 responsibility，**绝对不能合并多条内容**
3. 最终只输出纯 JSON 文本，禁止添加任何解释、注释、Markdown、多余文字、换行修饰
4. 技能仅提取技术、框架、编程语言、工具，过滤主观描述类文字
5. **内容精简规则**：experiences.content 和 responsibilities.text 需精简提炼，保留动词+动作+成果，每条不超过100字，删除冗长描述和重复信息

# 输出固定结构（不可修改字段名、层级）
{
  "basic": {
    "education": "",
    "work_years": "",
    "job_type": ""
  },
  "skills": [],
  "experiences": [
    {
      "company": "",
      "position": "",
      "duration": "",
      "content": ""
    }
  ],
  "projects": [
    {
      "name": "",
      "duration": "",
      "tech_stack": [],
      "responsibilities": [
        {
          "label": "",
          "text": ""
        }
      ]
    }
  ]
}

# 【示范样例参考】
## 示例输入简历（仅用来学习规则，不要解析本段内容）
个人信息：本科，3年后端开发经验，求职全职岗位
掌握技能：Java、SpringBoot、MySQL、Redis、Git、Linux
工作经历1：XX科技 | 后端开发 | 2022.03-至今
负责业务接口开发、数据存储优化、线上问题排查
工作经历2：XX互联网公司 | 实习开发 | 2021.07-2021.09
协助完成接口联调、文档编写

项目经历：电商秒杀系统 | 2022.06-2022.10
1. 项目简介：面向商城的高并发秒杀业务系统
2. 技术栈：Java、SpringBoot、Redis、MySQL
3. 核心功能：实现商品秒杀、库存扣减逻辑
4. 性能优化：使用缓存缓解数据库压力，提升并发承载能力

## 示例标准输出JSON（严格按照此格式、拆分规则输出）
{
  "basic": {
    "education": "本科",
    "work_years": "3年",
    "job_type": "全职"
  },
  "skills": ["Java", "SpringBoot", "MySQL", "Redis", "Git", "Linux"],
  "experiences": [
    {
      "company": "XX科技",
      "position": "后端开发",
      "duration": "2022.03-至今",
      "content": "负责业务接口开发、数据存储优化、线上问题排查"
    },
    {
      "company": "XX互联网公司",
      "position": "实习开发",
      "duration": "2021.07-2021.09",
      "content": "协助完成接口联调、文档编写"
    }
  ],
  "projects": [
    {
      "name": "电商秒杀系统",
      "duration": "2022.06-2022.10",
      "tech_stack": ["Java", "SpringBoot", "Redis", "MySQL"],
      "responsibilities": [
        {
          "label": "项目简介",
          "text": "面向商城的高并发秒杀业务系统"
        },
        {
          "label": "技术栈",
          "text": "Java、SpringBoot、Redis、MySQL"
        },
        {
          "label": "核心功能",
          "text": "实现商品秒杀、库存扣减逻辑"
        },
        {
          "label": "性能优化",
          "text": "使用缓存缓解数据库压力，提升并发承载能力"
        }
      ]
    }
  ]
}

# 重要提醒：以上仅为规则示范，**请只解析下面这段真实简历文本**
# 待解析简历文本：
${text.trim()}
        `
      }]
    });

    // 2. 提取并清洗JSON
    const rawContent = response.choices[0]?.message?.content || '';
    const jsonStr = cleanJsonString(rawContent);
    const result = JSON.parse(jsonStr);

    // 3. 数据兜底 + 清洗（保证字段一定存在，类型正确）
    const finalResult = {
      basic: {
        education: result.basic?.education || '',
        work_years: result.basic?.work_years || '',
        job_type: result.basic?.job_type || '',
      },
      skills: uniqueArray(result.skills || []),
      experiences: result.experiences?.map(item => ({
        company: item.company || '',
        position: item.position || '',
        duration: item.duration || '',
        content: item.content || ''
      })) || [],
      projects: result.projects?.map(item => ({
        name: item.name || '',
        duration: item.duration || '',
        tech_stack: uniqueArray(item.tech_stack || []),
        responsibilities: item.responsibilities?.map(resp => ({
          label: resp.label || '',
          text: resp.text || ''
        })) || []
      })) || [],
      raw: rawContent, // 保留原始响应，便于调试
      status: 'success'
    };

    return finalResult;

  } catch (error) {
    // 4. 全链路异常捕获（API错误 + JSON解析错误 + 未知错误）
    console.error('简历解析失败:', error.message);
    return {
      basic: { education: '', work_years: '', job_type: '' },
      skills: [],
      experiences: [],
      projects: [],
      raw: error.message,
      status: 'error'
    };
  }
}