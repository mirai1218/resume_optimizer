export function parseMarkdown(text) {
  if (!text) return '';
  const lines = text.split('\n');
  const output = [];
  let i = 0;
  let inProject = false;

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.startsWith('[项目]')) {
      if (inProject) output.push('</details>');
      inProject = true;
      const name = line.replace('[项目]', '').trim();
      output.push(`<details class="md-project"><summary>${name}</summary>`);
      i++;
      continue;
    }

    if (/^\[修改\d+\]/.test(line)) {
      const label = line.match(/^\[([^\]]+)\]/)?.[1] || '';
      const rest = line.replace(/^\[[^\]]+\]\s*/, '').trim();
      const cardLines = [`<div class="md-card">`, `<div class="md-module"><span class="md-module-label">${label}：</span> ${rest}</div>`];

      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j].trim();
        if (nextLine.startsWith('[修改') || nextLine.startsWith('[项目]') || nextLine.startsWith('项目优化概览：') || nextLine.startsWith('项目整体优化总结：')) {
          break;
        }
        if (nextLine === '') {
          j++;
          continue;
        }
        if (nextLine.startsWith('原文：')) {
          const content = nextLine.replace('原文：', '');
          cardLines.push(`<div class="md-original"><span class="md-label md-label-original">原文：</span>${content}</div>`);
        } else if (nextLine.startsWith('优化后：')) {
          const content = nextLine.replace('优化后：', '');
          cardLines.push(`<div class="md-optimized"><span class="md-label md-label-optimized">优化后：</span>${content}</div>`);
        } else if (nextLine.startsWith('改写思路：')) {
          const content = nextLine.replace('改写思路：', '');
          cardLines.push(`<div class="md-reason"><span class="md-label md-label-reason">改写思路：</span>${content}</div>`);
        }
        j++;
      }

      cardLines.push('</div>');
      output.push(cardLines.join('\n'));
      i = j;
      continue;
    }

    if (line.startsWith('项目优化概览：')) {
      output.push(`<div class="md-overview">${line}</div>`);
      i++;
      continue;
    }

    if (line.startsWith('项目整体优化总结：')) {
      output.push(`<div class="md-summary">${line}</div>`);
      i++;
      continue;
    }

    if (line === '') {
      i++;
      continue;
    }

    i++;
  }

  if (inProject) output.push('</details>');
  return output.join('\n');
}
