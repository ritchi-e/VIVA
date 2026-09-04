import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

export type HomeTheme = 'dark' | 'light'

const STORAGE_KEY = 'mokhik-home-theme'

type HomeThemeContextValue = {
  theme: HomeTheme
  isLight: boolean
  setTheme: (theme: HomeTheme) => void
  toggleTheme: () => void
}

const HomeThemeContext = createContext<HomeThemeContextValue | null>(null)

function readStoredTheme(): HomeTheme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'light' || raw === 'dark') return raw
  } catch {
    /* ignore */
  }
  return 'dark'
}

export function HomeThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<HomeTheme>(() =>
    typeof window === 'undefined' ? 'dark' : readStoredTheme(),
  )

  const setTheme = useCallback((next: HomeTheme) => {
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [setTheme, theme])

  useEffect(() => {
    const body = document.body
    body.classList.add(theme === 'dark' ? 'mk-dark' : 'mk-light')
    body.classList.remove(theme === 'dark' ? 'mk-light' : 'mk-dark')
    return () => {
      body.classList.remove('mk-dark', 'mk-light')
    }
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      isLight: theme === 'light',
      setTheme,
      toggleTheme,
    }),
    [setTheme, theme, toggleTheme],
  )

  return <HomeThemeContext.Provider value={value}>{children}</HomeThemeContext.Provider>
}

export function useHomeTheme() {
  const ctx = useContext(HomeThemeContext)
  if (!ctx) throw new Error('useHomeTheme must be used within HomeThemeProvider')
  return ctx
}

/** Extreme-right control for switching landing light/dark modes. */
export function HomeThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useHomeTheme()
  const isLight = theme === 'light'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
      title={isLight ? 'Dark mode' : 'Light mode'}
      className={cn(
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition',
        'border-[color:var(--mk-border)] text-[color:var(--mk-fg-60)]',
        'hover:border-[color:var(--mk-border-12)] hover:text-[color:var(--mk-nav-hover)]',
        'bg-[color:var(--mk-panel)] backdrop-blur-xl',
        className,
      )}
    >
      {isLight ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  )
}
