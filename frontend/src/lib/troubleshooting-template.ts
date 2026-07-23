import {
  parseRichTextValue,
  type RichTextDocumentNode,
} from './rich-text-document'

function text(value: string): RichTextDocumentNode {
  return { type: 'text', text: value }
}

function heading(value: string): RichTextDocumentNode {
  return { type: 'heading', attrs: { level: 2 }, content: [text(value)] }
}

function paragraph(value: string): RichTextDocumentNode {
  return { type: 'paragraph', content: value ? [text(value)] : undefined }
}

function listItem(value: string): RichTextDocumentNode {
  return { type: 'listItem', content: [paragraph(value)] }
}

export const TROUBLESHOOTING_TEMPLATE: RichTextDocumentNode = {
  type: 'doc',
  content: [
    heading('故障现象与复现条件'),
    paragraph('记录可观察、可重复的表现，以及出现问题时的硬件与软件环境。'),
    heading('测量条件与测量点'),
    paragraph('写明供电、负载、量程、仪器、参考地和关键测量点。'),
    heading('分步排查'),
    {
      type: 'orderedList',
      content: [
        listItem('先做最小范围检查，并记录测量值。'),
        listItem('根据预期结果决定下一步。'),
      ],
    },
    heading('预期结果与判断分支'),
    paragraph('写明每一步的正常范围，以及符合或不符合时分别继续检查什么。'),
    heading('可能根因'),
    { type: 'bulletList', content: [listItem('按可能性从高到低列出根因。')] },
    heading('修复方案'),
    paragraph('记录实际执行的修改和必要的安全注意事项。'),
    heading('修复验证'),
    paragraph('在相同测量条件下复测，并说明如何确认问题已经解决。'),
    heading('参考资料'),
    paragraph('列出数据手册章节、标准、原理图版本或可靠的外部资料。'),
  ],
}

function nodeText(node: RichTextDocumentNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'inlineFormula') return String(node.attrs?.formula ?? '')
  return (node.content ?? []).map(nodeText).join(' ')
}

export function richTextPlainText(value: string) {
  return nodeText(parseRichTextValue(value)).replace(/\s+/g, ' ').trim()
}

export function insertTroubleshootingTemplate(value: string) {
  const current = parseRichTextValue(value)
  const hasContent = Boolean(richTextPlainText(value))
  return JSON.stringify({
    type: 'doc',
    content: [
      ...(hasContent ? current.content ?? [] : []),
      ...(hasContent ? [{ type: 'horizontalRule' }] : []),
      ...(TROUBLESHOOTING_TEMPLATE.content ?? []),
    ],
  })
}

export function missingDraftSections({
  applicability,
  checklist,
  body,
}: {
  applicability: string
  checklist: string[]
  body: string
}) {
  const value = `${applicability} ${checklist.join(' ')} ${richTextPlainText(body)}`
    .replace(/\s+/g, '')
  const checks = [
    ['测量条件', ['测量条件', '供电条件', '测试条件', '测量点']],
    ['排查步骤', ['排查步骤', '分步排查', '检查步骤']],
    ['预期结果', ['预期结果', '正常范围', '判断分支']],
    ['可能根因', ['可能根因', '根因', '原因']],
    ['修复验证', ['修复验证', '复测', '验证修复']],
    ['参考资料', ['参考资料', '数据手册', '参考来源']],
  ] as const

  return checks.flatMap(([label, words]) =>
    words.some((word) => value.includes(word)) ? [] : [label],
  )
}
