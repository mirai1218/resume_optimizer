import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// ==================== 配置化管理（便于维护/切换模型） ====================
const AI_CONFIG = {
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  temperature: 0.1, // 极低随机性，保证匹配结果稳定
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

/**
 * 标准化技能名称（统一大小写、移除常见后缀）
 * 解决 "MySQL" vs "mysql"、"React.js" vs "React" 等写法不一致问题
 */
const normalizeSkill = (skill) => {
  return skill
    .toLowerCase()
    .replace(/\.js$/i, '')        // 移除 .js 后缀：React.js → react
    .replace(/\.ts$/i, '')        // 移除 .ts 后缀：TypeScript.ts → typescript
    .replace(/\.py$/i, '')        // 移除 .py 后缀
    .replace(/\.go$/i, '')        // 移除 .go 后缀
    .replace(/^node\.js$/i, 'node') // 特殊处理 node.js → node
    .replace(/^vue\.js$/i, 'vue')
    .replace(/^angular\.js$/i, 'angular')
    .replace(/\s+/g, '')          // 移除所有空格
    .replace(/-/g, '')            // 移除连字符
    .trim();
};

/**
 * 标准化简历数据中的技能名称
 */
const normalizeResumeData = (resumeData) => {
  if (!resumeData) return {};
  return {
    ...resumeData,
    skills: uniqueArray((resumeData.skills || []).map(s => normalizeSkill(s)))
  };
};

// ==================== 核心匹配函数 ====================
export async function calculateMatch(resumeData, jdData) {
  // 标准化简历中的技能名称（统一大小写、移除后缀）
  const normalizedResumeData = normalizeResumeData(resumeData);

  // 提取软技能（不参与匹配，用于生成面试建议）
  const softSkills = jdData.requirements?.bonus_soft_skill || [];

  try {
    const response = await client.chat.completions.create({
      model: AI_CONFIG.model,
      temperature: AI_CONFIG.temperature,
      max_tokens: AI_CONFIG.maxTokens,
      messages: [{
        role: 'user',
        content: `你是简历岗位匹配分析师，结合解析后的简历信息、岗位任职要求、岗位职责，从两个维度做对标匹配，**不输出任何数字分数**，只判定匹配状态+说明原因。

判定通用规则：
1. 技能栏与项目内容分开评判：技能对标仅对比技能栏填写内容；项目经历中出现的算法、技术框架、自研工具等，不纳入技能栏冗余评判范围，不建议删除
2. 同类型工具统一标准：功能用途一致的工具或平台，采用相同评判尺度，不区别对待、不偏心删减
3. 不删减真实掌握的内容：简历技能栏中列出的技术，是求职者真实掌握并主动呈现的，不随意判定为冗余或建议删除
4. 仅围绕当前招聘岗位方向判断适配度，不超出岗位需求范围进行评判

专业相关性判断：
- 专业名称完全相同或高度相关（如"软件工程"和"计算机科学与技术"）→ 完全匹配
- 属于同一学科门类（如都是工学、理学、经济学、管理学等）→ 部分匹配
- 跨学科门类且无关联 → 存在缺失
- 若 JD 要求"计算机相关专业"而简历为"电子信息工程"，因同属工学门类 → 部分匹配

匹配维度：
维度1：硬技能对标 → 对照岗位硬性要求（must）和加分项（preferred），判定技能栏内容满足情况
维度2：工作场景对标 → 对照岗位职责，判断简历经历是否贴合岗位日常工作

软技能说明：性格、态度、学习能力类要求（如沟通能力、团队合作）简历中难以直接体现，不参与匹配，但应在 overall_summary 中给出面试建议

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
  "soft_skill_tips": "软技能面试建议，如：此类软技能要求（沟通能力、团队合作等）建议在面试中展示",
  "overall_summary": "整体匹配概括，点明简历优势与主要欠缺的工作场景，可包含软技能面试建议"
}

传入数据：
简历信息：${JSON.stringify(normalizedResumeData, null, 2)}
岗位硬性要求（must）：${JSON.stringify(jdData.requirements?.must || [], null, 2)}
岗位加分项（preferred）：${JSON.stringify(jdData.requirements?.preferred || [], null, 2)}
岗位职责：${JSON.stringify(jdData.responsibilities || [], null, 2)}`
      }]
    });

    // 提取并清洗JSON
    const rawContent = response.choices[0]?.message?.content || '';
    const jsonStr = cleanJsonString(rawContent);
    const result = JSON.parse(jsonStr);

    // 数据兜底
    const finalResult = {
      skill_match: uniqueArray(result.skill_match || []).map(item => ({
        job_demand: item.job_demand || '',
        resume_status: item.resume_status || '存在缺失',
        explain: item.explain || ''
      })),
      scene_match: uniqueArray(result.scene_match || []).map(item => ({
        job_duty: item.job_duty || '',
        resume_status: item.resume_status || '存在缺失',
        explain: item.explain || ''
      })),
      soft_skill_tips: result.soft_skill_tips || generateSoftSkillTips(softSkills),
      overall_summary: result.overall_summary || '',
      raw: rawContent,
      status: 'success'
    };

    return finalResult;

  } catch (error) {
    console.error('匹配分析失败:', error.message);
    return {
      skill_match: [],
      scene_match: [],
      soft_skill_tips: generateSoftSkillTips(softSkills),
      overall_summary: '匹配分析失败，请重试',
      raw: error.message,
      status: 'error'
    };
  }
}

/**
 * 根据软技能列表自动生成面试建议
 */
function generateSoftSkillTips(softSkills) {
  if (!softSkills || softSkills.length === 0) return '';
  const skillsText = softSkills.join('、');
  return `该岗位要求中的${skillsText}等软技能难以从简历中直接体现，建议在面试中主动展示相关能力与经历。`;
}