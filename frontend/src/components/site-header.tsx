import { BookOpenText, Menu, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { SearchForm } from './search-form'
import styles from './site-header.module.css'

const navigation = [
  { to: '/', label: '首页', end: true },
  { to: '/explore', label: '知识库', end: false },
]

export function SiteHeader() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname, location.search])

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link className={styles.brand} to="/" aria-label="电赛白皮书首页">
          <BookOpenText aria-hidden="true" size={24} strokeWidth={1.8} />
          <span>电赛白皮书</span>
        </Link>

        <nav className={styles.desktopNav} aria-label="主导航">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              className={({ isActive }) =>
                `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
              }
              end={item.end}
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.desktopSearch}>
          <SearchForm
            initialValue={
              location.pathname === '/explore'
                ? new URLSearchParams(location.search).get('q') ?? ''
                : ''
            }
            variant="compact"
            showSuggestions={false}
          />
        </div>

        <span className={styles.scope}>公开知识库</span>

        <div className={styles.mobileActions}>
          <Link
            className={styles.iconButton}
            to="/explore"
            aria-label="打开搜索"
          >
            <Search aria-hidden="true" size={20} />
          </Link>
          <button
            className={styles.iconButton}
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            aria-label={menuOpen ? '关闭导航' : '打开导航'}
            onClick={() => setMenuOpen((current) => !current)}
          >
            {menuOpen ? (
              <X aria-hidden="true" size={20} />
            ) : (
              <Menu aria-hidden="true" size={20} />
            )}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <nav
          id="mobile-navigation"
          className={styles.mobileNav}
          aria-label="移动端导航"
        >
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              className={({ isActive }) =>
                `${styles.mobileNavLink} ${
                  isActive ? styles.mobileNavLinkActive : ''
                }`
              }
              end={item.end}
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
          <span className={styles.mobileScope}>公开知识库</span>
        </nav>
      ) : null}
    </header>
  )
}
