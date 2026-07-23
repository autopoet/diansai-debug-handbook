import { useMemo, useState } from 'react'
import type { ArticleRevision } from '../api/articles'
import {
  parseRichTextValue,
  type RichTextDocumentNode,
} from '../lib/rich-text-document'
import { RichTextContent } from './rich-text-content'
import styles from './revision-diff.module.css'

type Change = {
  kind: 'addition' | 'deletion' | 'modification'
  before?: string
  after?: string
}

function nodeText(node: RichTextDocumentNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return '\n'
  if (node.type === 'inlineFormula') return String(node.attrs?.formula ?? '')
  return (node.content ?? []).map(nodeText).join('')
}

function semanticBlocks(value: string) {
  const document = parseRichTextValue(value)
  const blocks: string[] = []

  function visit(node: RichTextDocumentNode, context = '') {
    const text = nodeText(node).trim()
    switch (node.type) {
      case 'heading':
        blocks.push(`标题 ${Number(node.attrs?.level) || 2} · ${text}`)
        return
      case 'paragraph':
        if (text) blocks.push(`${context || '段落'} · ${text}`)
        return
      case 'listItem':
        if (text) blocks.push(`${context || '列表项'} · ${text}`)
        return
      case 'bulletList':
        for (const child of node.content ?? []) visit(child, '无序列表')
        return
      case 'orderedList':
        for (const child of node.content ?? []) visit(child, '有序列表')
        return
      case 'blockquote':
        if (text) blocks.push(`引用 · ${text}`)
        return
      case 'codeBlock':
        blocks.push(`代码块 · ${text || '（空）'}`)
        return
      case 'image':
        blocks.push(
          `图片 · ${String(node.attrs?.alt ?? '未填写说明')} · ${String(node.attrs?.src ?? '')}`,
        )
        return
      case 'tableRow':
        blocks.push(
          `表格行 · ${(node.content ?? []).map(nodeText).map((item) => item.trim()).join(' | ')}`,
        )
        return
      case 'horizontalRule':
        blocks.push('分隔线')
        return
      default:
        for (const child of node.content ?? []) visit(child, context)
    }
  }

  visit(document)
  return blocks
}

function blockDiff(before: string[], after: string[]) {
  const table = Array.from(
    { length: before.length + 1 },
    () => new Uint32Array(after.length + 1),
  )
  for (let left = before.length - 1; left >= 0; left -= 1) {
    for (let right = after.length - 1; right >= 0; right -= 1) {
      table[left][right] =
        before[left] === after[right]
          ? table[left + 1][right + 1] + 1
          : Math.max(table[left + 1][right], table[left][right + 1])
    }
  }

  const changes: Change[] = []
  let left = 0
  let right = 0
  while (left < before.length || right < after.length) {
    if (
      left < before.length &&
      right < after.length &&
      before[left] === after[right]
    ) {
      left += 1
      right += 1
      continue
    }

    const removed: string[] = []
    const added: string[] = []
    while (
      left < before.length &&
      (right === after.length ||
        table[left + 1][right] >= table[left][right + 1])
    ) {
      removed.push(before[left])
      left += 1
      if (
        left < before.length &&
        right < after.length &&
        before[left] === after[right]
      ) {
        break
      }
    }
    while (
      right < after.length &&
      (left === before.length ||
        table[left][right + 1] > table[left + 1][right])
    ) {
      added.push(after[right])
      right += 1
      if (
        left < before.length &&
        right < after.length &&
        before[left] === after[right]
      ) {
        break
      }
    }
    if (!removed.length && left < before.length) {
      removed.push(before[left])
      left += 1
    }
    if (!added.length && right < after.length) {
      added.push(after[right])
      right += 1
    }

    const length = Math.max(removed.length, added.length)
    for (let index = 0; index < length; index += 1) {
      const oldBlock = removed[index]
      const newBlock = added[index]
      changes.push(
        oldBlock && newBlock
          ? { kind: 'modification', before: oldBlock, after: newBlock }
          : oldBlock
            ? { kind: 'deletion', before: oldBlock }
            : { kind: 'addition', after: newBlock },
      )
    }
  }
  return changes
}

const fields = [
  ['标题', (revision: ArticleRevision) => revision.title],
  ['摘要', (revision: ArticleRevision) => revision.summary],
  ['适用范围', (revision: ArticleRevision) => revision.applicability],
  ['安全提示', (revision: ArticleRevision) => revision.safety],
  ['快速检查清单', (revision: ArticleRevision) => revision.checklist.join('\n')],
] as const

function RevisionPreview({
  revision,
  emptyLabel,
}: {
  revision: ArticleRevision | null
  emptyLabel: string
}) {
  if (!revision) return <p className={styles.emptyPreview}>{emptyLabel}</p>
  return (
    <div className={styles.preview}>
      <h3>{revision.title}</h3>
      <p>{revision.summary}</p>
      <dl>
        <div><dt>适用范围</dt><dd>{revision.applicability || '—'}</dd></div>
        <div><dt>安全提示</dt><dd>{revision.safety || '—'}</dd></div>
        <div><dt>快速检查</dt><dd>{revision.checklist.join('；') || '—'}</dd></div>
      </dl>
      <RichTextContent value={revision.body} />
    </div>
  )
}

export function RevisionDiff({
  baseRevision,
  revision,
}: {
  baseRevision: ArticleRevision | null
  revision: ArticleRevision
}) {
  const [view, setView] = useState<'changes' | 'before' | 'after'>('changes')
  const changedFields = useMemo(
    () =>
      fields.flatMap(([label, read]) => {
        const before = baseRevision ? read(baseRevision) : ''
        const after = read(revision)
        return before === after
          ? []
          : [{ label, changes: blockDiff(before.split('\n'), after.split('\n')) }]
      }),
    [baseRevision, revision],
  )
  const bodyChanges = useMemo(
    () =>
      blockDiff(
        baseRevision ? semanticBlocks(baseRevision.body) : [],
        semanticBlocks(revision.body),
      ),
    [baseRevision, revision],
  )
  const totalChanges =
    changedFields.reduce((count, field) => count + field.changes.length, 0) +
    bodyChanges.length

  return (
    <section className={styles.diff} aria-label="版本差异">
      <header className={styles.header}>
        <div>
          <strong>
            {baseRevision ? `v${baseRevision.version_number}` : '空白文档'}
            {' → '}
            v{revision.version_number}
          </strong>
          <span>{totalChanges} 处可见内容变化</span>
        </div>
        <p>{revision.edit_summary}</p>
      </header>

      <nav className={styles.viewSwitch} aria-label="差异视图">
        {([
          ['changes', '变更'],
          ['before', '修改前'],
          ['after', '修改后'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={view === value}
            onClick={() => setView(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      {view === 'before' ? (
        <RevisionPreview revision={baseRevision} emptyLabel="这是新文档，没有修改前版本。" />
      ) : null}
      {view === 'after' ? (
        <RevisionPreview revision={revision} emptyLabel="" />
      ) : null}
      {view === 'changes' ? (
        <div className={styles.changes}>
          {changedFields.map((field) => (
            <section key={field.label} className={styles.field}>
              <h3>{field.label}</h3>
              {field.changes.map((change, index) => (
                <ChangeBlock
                  key={`${field.label}-${index}`}
                  change={change}
                />
              ))}
            </section>
          ))}
          {bodyChanges.length ? (
            <section className={styles.field}>
              <h3>正文</h3>
              {bodyChanges.map((change, index) => (
                <ChangeBlock key={`body-${index}`} change={change} />
              ))}
            </section>
          ) : null}
          {!totalChanges ? <p className={styles.emptyPreview}>可见内容没有变化。</p> : null}
        </div>
      ) : null}
    </section>
  )
}

function ChangeBlock({ change }: { change: Change }) {
  if (change.kind === 'modification') {
    return (
      <div className={styles.modification}>
        <span>修改前</span>
        <p>{change.before}</p>
        <span>修改后</span>
        <p>{change.after}</p>
      </div>
    )
  }
  return (
    <div className={styles[change.kind]}>
      <span>{change.kind === 'addition' ? '新增' : '删除'}</span>
      <p>{change.after ?? change.before}</p>
    </div>
  )
}
