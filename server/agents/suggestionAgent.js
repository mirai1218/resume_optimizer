import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

const MODEL = 'deepseek-chat';

export async function generateSuggestions(resumeData, jdData, matchResult, resumeText) {
  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [{
      role: 'user',
      content: `你是专业简历优化师，基于前面的匹配差距结果，围绕岗位任职要求+日常工作职责改写简历内容。

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
岗位全部信息：${JSON.stringify(jdData, null, 2)}
匹配差距结果：${JSON.stringify(matchResult, null, 2)}`
    }]
  });
  return response.choices[0].message.content;
}