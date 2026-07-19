import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CircleGauge, SlidersHorizontal } from 'lucide-react'
import { Fragment } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listSymptoms, symptomKeys } from '../api/symptoms'
import {
  EmptyState,
  ErrorState,
  ListSkeleton,
} from '../components/request-state'
import { SearchForm } from '../components/search-form'
import styles from './explore-page.module.css'

function HighlightedText({
  text,
  keyword,
}: {
  text: string
  keyword: string
}) {
  if (!keyword) {
    return text
  }

  const normalizedText = text.toLocaleLowerCase()
  const normalizedKeyword = keyword.toLocaleLowerCase()
  const parts: Array<{ value: string; highlighted: boolean }> = []
  let cursor = 0
  let matchIndex = normalizedText.indexOf(normalizedKeyword)

  while (matchIndex >= 0) {
    if (matchIndex > cursor) {
      parts.push({
        value: text.slice(cursor, matchIndex),
        highlighted: false,
      })
    }
    parts.push({
      value: text.slice(matchIndex, matchIndex + keyword.length),
      highlighted: true,
    })
    cursor = matchIndex + keyword.length
    matchIndex = normalizedText.indexOf(normalizedKeyword, cursor)
  }

  if (cursor < text.length) {
    parts.push({ value: text.slice(cursor), highlighted: false })
  }

  return parts.map((part, index) => (
    <Fragment key={`${part.value}-${index}`}>
      {part.highlighted ? <mark>{part.value}</mark> : part.value}
    </Fragment>
  ))
}

export default function ExplorePage() {
  const [searchParams] = useSearchParams()
  const keyword = (searchParams.get('q') ?? '').trim()
  const keywordIsValid =
    keyword.length === 0 || (keyword.length >= 2 && keyword.length <= 20)
  const visibleKeyword =
    keyword.length > 20 ? `${keyword.slice(0, 20)}…` : keyword

  const symptomsQuery = useQuery({
    queryKey: symptomKeys.list(keyword || undefined),
    queryFn: ({ signal }) => listSymptoms(keyword || undefined, signal),
    enabled: keywordIsValid,
  })

  const title = visibleKeyword
    ? `“${visibleKeyword}”的搜索结果`
    : '浏览故障现象'
  const total = symptomsQuery.data?.total ?? 0

  return (
    <main id="main-content" className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.breadcrumb}>
          <Link to="/">首页</Link>
          <span aria-hidden="true">/</span>
          <span>知识库</span>
        </div>
        <div className={styles.titleRow}>
          <div>
            <h1>{title}</h1>
            <p>
              先按故障现象缩小范围，再结合器件、平台和测量结果判断。
            </p>
          </div>
          {symptomsQuery.isFetching && !symptomsQuery.isLoading ? (
            <span className={styles.updating} aria-live="polite">
              正在更新结果
            </span>
          ) : null}
        </div>
        <div className={styles.search}>
          <SearchForm
            initialValue={keyword}
            variant="page"
            showSuggestions={false}
          />
        </div>
      </header>

      <div className={styles.content}>
        <aside className={styles.sidebar} aria-labelledby="narrow-title">
          <SlidersHorizontal aria-hidden="true" size={20} />
          <h2 id="narrow-title">缩小排查范围</h2>
          <p>
            搜索时优先写现象，再补充器件名、接口或测量结果。暂时不确定技术方向也没关系。
          </p>
          <dl>
            <div>
              <dt>现象</dt>
              <dd>掉压、复位、乱码、振荡</dd>
            </div>
            <div>
              <dt>对象</dt>
              <dd>LDO、ADC、UART、电机</dd>
            </div>
            <div>
              <dt>条件</dt>
              <dd>带载、升温、整机联调</dd>
            </div>
          </dl>
        </aside>

        <section className={styles.results} aria-labelledby="results-title">
          <div className={styles.resultsHeader}>
            <div>
              <h2 id="results-title">
                {keyword ? '匹配结果' : '全部故障现象'}
              </h2>
              {keywordIsValid && symptomsQuery.data ? (
                <p aria-live="polite">共 {total} 条结果</p>
              ) : null}
            </div>
            <span className={styles.resultType}>
              <CircleGauge aria-hidden="true" size={17} />
              按故障现象组织
            </span>
          </div>

          {!keywordIsValid ? (
            <EmptyState
              title={keyword.length > 20 ? '搜索词过长' : '搜索词太短'}
              description={
                keyword.length > 20
                  ? '搜索词最多 20 个字符，请缩短后再试。'
                  : '请至少输入 2 个字符，或者清空搜索词浏览全部故障现象。'
              }
              action={
                <Link className={styles.stateAction} to="/explore">
                  清空搜索
                </Link>
              }
            />
          ) : null}

          {symptomsQuery.isLoading ? <ListSkeleton rows={5} /> : null}

          {keywordIsValid &&
          symptomsQuery.isError &&
          !symptomsQuery.data ? (
            <ErrorState
              description="搜索服务暂时没有响应。你可以保留当前关键词并重新加载。"
              onRetry={() => void symptomsQuery.refetch()}
            />
          ) : null}

          {keywordIsValid &&
          symptomsQuery.isError &&
          symptomsQuery.data ? (
            <p className={styles.refreshNotice} role="status">
              更新暂时失败，当前显示上次加载的结果。
            </p>
          ) : null}

          {keywordIsValid &&
          symptomsQuery.data &&
          symptomsQuery.data.items.length === 0 ? (
            <EmptyState
              title={`没有找到“${keyword}”`}
              description="尝试删除具体型号、换用更短的故障现象，或先浏览全部条目。"
              action={
                <Link className={styles.stateAction} to="/explore">
                  浏览全部故障现象
                </Link>
              }
            />
          ) : null}

          {keywordIsValid &&
          symptomsQuery.data &&
          symptomsQuery.data.items.length > 0 ? (
            <ul className={styles.resultList}>
              {symptomsQuery.data.items.map((symptom) => (
                <li key={symptom.id}>
                  <Link
                    className={styles.resultLink}
                    to={`/articles/${symptom.id}`}
                  >
                    <div className={styles.resultMain}>
                      <h3>
                        <HighlightedText
                          text={symptom.name}
                          keyword={keyword}
                        />
                      </h3>
                      <p>
                        <HighlightedText
                          text={symptom.description}
                          keyword={keyword}
                        />
                      </p>
                      <span>故障现象 · 排查入口</span>
                    </div>
                    <ArrowRight
                      className={styles.resultArrow}
                      aria-hidden="true"
                      size={20}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </main>
  )
}
