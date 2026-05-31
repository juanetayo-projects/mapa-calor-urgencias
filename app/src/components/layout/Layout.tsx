import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useStore } from '@/store/useStore'
import { clsx } from 'clsx'

export default function Layout() {
  const { sidebarCollapsed } = useStore()

  return (
    <div className="h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <main
        className={clsx(
          'transition-all duration-300 h-screen flex flex-col',
          sidebarCollapsed ? 'ml-16' : 'ml-60'
        )}
      >
        {/* flex-1 min-h-0: crítico para que h-full del Outlet funcione */}
        <div className="flex-1 min-h-0">
          <Outlet />
        </div>

        {/* Footer */}
        <footer className="flex-shrink-0 py-1.5 px-4 border-t border-slate-100 bg-slate-50">
          <p className="text-[10px] text-slate-300 text-center tracking-wide">
            Desarrollado por: Ing. Juan Carlos Etayo Ruiz
          </p>
        </footer>
      </main>
    </div>
  )
}
