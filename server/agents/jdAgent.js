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
  maxTokens: 4000,
};

// 初始化客户端
const client = new OpenAI({
  apiKey: AI_CONFIG.apiKey,
  baseURL: AI_CONFIG.baseURL,
});

// ==================== 工具函数 ====================
/**
 * 数组去重 + 空值过滤
 */
const uniqueArray = (arr) => [...new Set(arr.filter(Boolean))];

/**
 * 清洗模型返回的JSON字符串
 */
const cleanJsonString = (str) => {
  return str
    .replace(/```(json)?\n?/gi, '')
    .replace(/```/g, '')
    .replace(/[\n\r\t]/g, ' ')      // 移除换行/制表符，转为空格
    .replace(/\\n/g, ' ')           // 移除转义换行符
    .replace(/\\u00a0/g, ' ')      // 移除不间断空格
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
    .trim();
};

// ==================== 核心解析函数 ====================
export async function parseJD(text) {
  // 1. 输入校验
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return {
      requirements: { must: [], preferred: [], bonus_soft_skill: [] },
      responsibilities: [],
      raw: '输入JD文本为空',
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
# 角色：JD（岗位描述）解析专家
# 强制核心规则
1. 绝对禁止编造、脑补！先清洗JD文本中的特殊符号（●、★、■、冗余换行），再提取**明确写出**的内容
2. 同一技能/要求只能出现在一个分类中，禁止重复；所有数组内的条目自动去重，避免重复内容
3. responsibilities 提炼3-8条核心职责，精简短句，每条不超过30字
4. 最终只输出纯 JSON 文本，禁止任何解释、Markdown；若某分类无内容，对应数组必须为空数组（如"must": []），禁止缺失字段

# 分类判断标准
| 分类 | 判断依据 | 示例 |
|------|----------|------|
| must | 硬性门槛：学历、专业、必备语言/工具、年限 | 本科、计算机专业、熟悉Java、3年经验 |
| preferred | 加分项：含“优先”“最好”“有XX经验者佳”“加分”等表述，无也行但明显有益 | 熟悉K8S、有实习经验、掌握Python |
| bonus_soft_skill | 软性优势：性格、态度、学习能力，简历中难以直接体现 | 沟通能力强、团队合作精神、对XX有浓厚兴趣 |

# 输出固定结构
{
  "requirements": {
    "must": [],
    "preferred": [],
    "bonus_soft_skill": []
  },
  "responsibilities": []
}

# 【示范样例参考】
## 示例输入JD（仅学习规则，不要解析）
职位：高级前端工程师
职责：
- 负责淘宝首页架构设计与优化
- 主导前端技术选型，推动工程化落地
- 解决浏览器兼容性、性能优化等技术难题
- 带领团队完成业务目标

要求：
- 本科及以上学历，计算机相关专业
- 5年以上前端开发经验，熟练掌握React/Vue
- 精通JavaScript/TypeScript，熟悉Webpack/Vite
- 有大型前端架构设计经验优先
- 善于沟通，有技术博客输出者优先

## 示例标准输出
{
  "requirements": {
    "must": [
      "本科及以上学历，计算机相关专业",
      "5年以上前端开发经验",
      "熟练掌握React/Vue",
      "精通JavaScript/TypeScript",
      "熟悉Webpack/Vite"
    ],
    "preferred": [
      "有大型前端架构设计经验"
    ],
    "bonus_soft_skill": [
      "善于沟通",
      "有技术博客输出经验"
    ]
  },
  "responsibilities": [
    "负责淘宝首页架构设计与优化",
    "主导前端技术选型，推动工程化落地",
    "解决浏览器兼容性、性能优化等技术难题",
    "带领团队完成业务目标"
  ]
}

# 重要提醒：以上仅为规则示范，**请只解析下面这段真实JD文本**
# 待解析JD文本：
${text.trim()}
        `
      }]
    });

    // 2. 提取并清洗JSON
    const rawContent = response.choices[0]?.message?.content || '';
    const jsonStr = cleanJsonString(rawContent);
    const result = JSON.parse(jsonStr);

    // 3. 数据兜底
    const finalResult = {
      requirements: {
        must: uniqueArray(result.requirements?.must || []),
        preferred: uniqueArray(result.requirements?.preferred || []),
        bonus_soft_skill: uniqueArray(result.requirements?.bonus_soft_skill || [])
      },
      responsibilities: uniqueArray(result.responsibilities || []),
      raw: rawContent,
      status: 'success'
    };

    return finalResult;

  } catch (error) {
    logger.error({ error_type: 'parse_error', message: error.message }, 'JD解析失败');
    return {
      requirements: { must: [], preferred: [], bonus_soft_skill: [] },
      responsibilities: [],
      raw: error.message,
      status: 'error'
    };
  }
}