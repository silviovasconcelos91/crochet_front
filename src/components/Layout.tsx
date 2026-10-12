import { Link, NavLink, Outlet } from 'react-router'

export function Layout() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur">
        <nav className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Link to="/" className="text-lg font-bold text-rose-700">
            🧶 Crochet
          </Link>
          <NavLink
            to="/account"
            className={({ isActive }) =>
              `grid min-h-11 place-items-center rounded-xl px-3 text-sm font-medium ${isActive ? 'bg-rose-50 text-rose-700' : 'text-stone-700'}`
            }
          >
            Compte
          </NavLink>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-2xl px-4 pt-4 pb-32">
        <Outlet />
      </main>
    </div>
  )
}
