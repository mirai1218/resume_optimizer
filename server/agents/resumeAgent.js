import OpenAI from 'openai';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

// ==================== 配置化管理（便于维护/切换模型） ====================
const AI_CONFIG = {
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.deepseek.com',
  model: 'deepseek-chat',
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
4. **skills 字段**：仅提取技术、框架、编程语言、工具名称，过滤主观描述类文字（如"熟悉""了解"等修饰词不要）
5. **skills_section 字段**：保留"个人技能/专业技能"模块的完整原文段落，包括所有描述性文字，不打散、不精简、不过滤

# 输出固定结构（不可修改字段名、层级）
{
  "basic": {
    "education": "",
    "work_years": "",
    "job_type": ""
  },
  "skills": [],
  "skills_section": "",
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

# 【教育背景提取规则】
education 字段格式：「学历|专业」，示例：
- 「硕士|电子信息工程」
- 「本科|计算机科学与技术」
- 「硕士|未明确写出专业」
- 「本科|未明确写出专业」

**重要**：
1. 专业名称必须从简历原文明确提取，不得脑补
2. 若简历只写「硕士」而未写明专业，education 填写「硕士|未明确写出专业」
3. 若简历只写「本科」而未写明专业，education 填写「本科|未明确写出专业」
4. 若简历明确写了专业名称（如「电子信息工程」「计算机科学」），必须完整保留

# 【个人技能/专业技能模块提取规则】
skills_section 字段：
1. 必须完整保留原文段落格式，包括换行符（\n）
2. 若简历中无"个人技能"或"专业技能"模块，skills_section 填写空字符串 ""
3. 不要打散或精简原文，保持原段落结构
4. skills_section 与 skills 是两个不同字段：
   - skills：技能关键词列表（如 ["Java", "MySQL"]）
   - skills_section：个人技能模块的完整原文段落

# 【示范样例参考】
## 示例输入简历（仅用来学习规则，不要解析本段内容）
个人信息：硕士，5年后端开发经验，求职全职岗位，专业：电子信息工程
掌握技能：Java、SpringBoot、MySQL、Redis、Git、Linux
工作经历1：XX科技 | 后端开发 | 2022.03-至今
负责业务接口开发、数据存储优化、线上问题排查

个人技能：
熟悉 Java、SpringBoot 框架开发，了解微服务架构设计；掌握 MySQL、Redis 数据库操作。
具备基本的 SQL 优化能力，能根据执行计划分析慢查询并优化。

项目经历：电商秒杀系统 | 2022.06-2022.10
1. 项目简介：面向商城的高并发秒杀业务系统
2. 技术栈：Java、SpringBoot、Redis、MySQL
3. 核心功能：实现商品秒杀、库存扣减逻辑
4. 性能优化：使用缓存缓解数据库压力，提升并发承载能力

## 示例标准输出JSON（严格按照此格式、拆分规则输出）
{
  "basic": {
    "education": "硕士|电子信息工程",
    "work_years": "5年",
    "job_type": "全职"
  },
  "skills": ["Java", "SpringBoot", "MySQL", "Redis", "Git", "Linux"],
  "skills_section": "熟悉 Java、SpringBoot 框架开发，了解微服务架构设计；掌握 MySQL、Redis 数据库操作。\n具备基本的 SQL 优化能力，能根据执行计划分析慢查询并优化。",
  "experiences": [
    {
      "company": "XX科技",
      "position": "后端开发",
      "duration": "2022.03-至今",
      "content": "负责业务接口开发、数据存储优化、线上问题排查"
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
      skills_section: result.skills_section || '',
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
    logger.error({ error_type: 'parse_error', message: error.message }, '简历解析失败');
    return {
      basic: { education: '', work_years: '', job_type: '' },
      skills: [],
      skills_section: '',
      experiences: [],
      projects: [],
      raw: error.message,
      status: 'error'
    };
  }
}