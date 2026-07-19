import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CheckCircle2, Search, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import { listSymptoms, symptomKeys } from '../api/symptoms'
import { ErrorState, ListSkeleton } from '../components/request-state'
import { SearchForm } from '../components/search-form'
import styles from './home-page.module.css'

export default function HomePage() {
  const symptomsQuery = useQuery({
    queryKey: symptomKeys.list(),
    queryFn: ({ signal }) => listSymptoms(undefined, signal),
  })

  return (
    <main id="main-content" className={styles.page}>
      <section className={styles.searchSection} aria-labelledby="home-title">
        <div className={styles.searchIntro}>
          <span className={styles.context}>
            公开协作知识库
            <span aria-hidden="true">·</span>
            修改审核后发布
          </span>
          <h1 id="home-title">从故障现象开始排查</h1>
          <p>
            描述你看到的现象、器件或错误信息，先找到可执行的检查顺序，再理解背后的原因。
          </p>
        </div>
        <div className={styles.primarySearch}>
          <SearchForm variant="hero" />
          <p className={styles.searchHint}>
            例如：无法上电、输出掉压、串口乱码
          </p>
        </div>
      </section>

      <section className={styles.contentGrid}>
        <div className={styles.symptomsSection}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>常见故障现象</h2>
              <p>不必先判断专业方向，从你能观察到的问题进入。</p>
            </div>
            <Link className={styles.sectionLink} to="/explore">
              浏览全部
              <ArrowRight aria-hidden="true" size={17} />
            </Link>
          </div>

          {symptomsQuery.isLoading ? <ListSkeleton rows={3} /> : null}
          {symptomsQuery.isError && !symptomsQuery.data ? (
            <ErrorState
              description="故障现象列表暂时没有加载成功。你的搜索内容不会丢失。"
              onRetry={() => void symptomsQuery.refetch()}
            />
          ) : null}
          {symptomsQuery.isError && symptomsQuery.data ? (
            <p className={styles.refreshNotice} role="status">
              更新暂时失败，当前显示上次加载的内容。
            </p>
          ) : null}
          {symptomsQuery.data ? (
            <ul className={styles.symptomList}>
              {symptomsQuery.data.items.map((symptom, index) => (
                <li key={symptom.id}>
                  <Link
                    className={styles.symptomLink}
                    to={`/articles/${symptom.id}`}
                  >
                    <span className={styles.symptomIndex}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className={styles.symptomContent}>
                      <strong>{symptom.name}</strong>
                      <span>{symptom.description}</span>
                    </span>
                    <ArrowRight
                      className={styles.symptomArrow}
                      aria-hidden="true"
                      size={19}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <aside className={styles.guide} aria-labelledby="guide-title">
          <div className={styles.signalMark} aria-hidden="true">
            <span />
          </div>
          <h2 id="guide-title">一篇可靠的排查文档</h2>
          <ol>
            <li>
              <Search aria-hidden="true" size={19} />
              <div>
                <strong>从现象出发</strong>
                <span>先记录可观察、可复现的表现。</span>
              </div>
            </li>
            <li>
              <CheckCircle2 aria-hidden="true" size={19} />
              <div>
                <strong>按顺序测量</strong>
                <span>每一步都写清预期结果和下一步。</span>
              </div>
            </li>
            <li>
              <ShieldCheck aria-hidden="true" size={19} />
              <div>
                <strong>验证后沉淀</strong>
                <span>保留条件、数据、风险和修复验证。</span>
              </div>
            </li>
          </ol>
          <p className={styles.guideNote}>
            所有公开修改都会留下版本记录，并在审核通过后生效。
          </p>
        </aside>
      </section>
    </main>
  )
}
