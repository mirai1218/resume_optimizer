import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// ==================== 配置化管理（便于维护/切换模型） ====================
const AI_CONFIG = {
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.minimaxi.com/v1',
  model: 'MiniMax-M2.7',
  temperature: 0.1,
  maxTokens: 8000,
};

// 初始化客户端
const client = new OpenAI({
  apiKey: AI_CONFIG.apiKey,
  baseURL: AI_CONFIG.baseURL,
});

// ==================== 核心优化函数 ====================
export async function generateSuggestions(resumeData, jdData, matchResult, resumeText) {
  // 输入校验
  if (!resumeText || !jdData || !matchResult) {
    return {
      content: '缺少必要的输入数据',
      status: 'error'
    };
  }

  // 提取硬技能要求（must + preferred），软技能不参与优化建议
  const hardRequirements = [
    ...(jdData.requirements?.must || []),
    ...(jdData.requirements?.preferred || [])
  ];
  const softSkills = jdData.requirements?.bonus_soft_skill || [];

  try {
    const response = await client.chat.completions.create({
      model: AI_CONFIG.model,
      temperature: AI_CONFIG.temperature,
      max_tokens: AI_CONFIG.maxTokens,
      messages: [{
        role: 'user',
        content: `你是专业简历优化师，基于前面的匹配差距结果，围绕岗位硬性要求和日常工作职责改写简历内容。

【重要】软技能优化限制：
- bonus_soft_skill 中的软技能要求（如沟通能力、团队合作、学习能力等）简历难以体现
- 优化建议只围绕硬技能（must + preferred）和工作场景展开
- 不要生成"加强沟通能力"、"展示团队合作精神"等软技能相关的优化建议

改写硬性规则：
1. 忠于用户真实经历，严禁编造虚假项目、工作内容与成果
2. Cursor、Kiro 同为AI测试辅助工具，评判保留标准保持统一，不单独差异化删减某一款工具
3. 仅出现在项目板块的算法、模型、特殊技术内容，属于个人项目特色亮点，不建议整体移除；可根据应聘岗位侧重，适度精简描述篇幅
4. 技能栏只精简重复、无关冗余话术，不无故删除本人真实掌握的技术与工具
5. 自然融入岗位必备关键词，描述贴合岗位实际工作场景，能力优势隐含在行为描述里，不单独罗列空洞话术
6. 严格区分技能栏与项目内容，分区域做优化建议

【格式强制要求】
1. 开头不要写任何套话，直接从第一个项目开始输出
2. 不要使用任何 emoji，只用文字和排版表达结构
3. 项目级整体打包：同一个项目的所有修改，必须放在同一个项目分组里，项目名仅出现一次，禁止拆成多个独立部分
4. 三层递进结构：每个项目的输出必须包含3部分：
   - 项目优化概览：一句话总结本次优化的核心思路
   - 分修改对比：每个修改用 [修改X] 修改标题 开头，按原文、优化后、改写思路的顺序输出
   - 项目整体优化总结：收尾，说明本次优化对岗位匹配的帮助
5. 修改之间用空行分隔，不要用 --- 或其他分隔符
6. 内容标识统一：原文用「原文：」开头，优化后用「优化后：」开头，改写思路用「改写思路：」开头
7. 优化后的内容必须精简，单条描述控制在2行以内

输出格式示例：
[项目] xxx

  项目优化概览：xxx

  [修改1] xxx
  原文：xxx
    优化后：xxx
    改写思路：xxx

  [修改2] xxx
  原文：xxx
    优化后：xxx
    改写思路：xxx

  项目整体优化总结：xxx

传入数据：
简历原始内容：${resumeText}
岗位硬性要求（must + preferred）：${JSON.stringify(hardRequirements, null, 2)}
岗位职责：${JSON.stringify(jdData.responsibilities || [], null, 2)}
匹配差距结果：${JSON.stringify(matchResult, null, 2)}`
      }]
    });

    const rawContent = response.choices[0]?.message?.content || '';

    return {
      content: rawContent,
      raw: rawContent,
      status: 'success'
    };

  } catch (error) {
    console.error('优化建议生成失败:', error.message);
    return {
      content: `优化建议生成失败：${error.message}`,
      raw: '',
      status: 'error'
    };
  }
}