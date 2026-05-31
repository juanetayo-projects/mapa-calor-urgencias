import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { useStore } from '@/store/useStore'
import { clsx } from 'clsx'

export default function Layout() {
  const { sidebarCollapsed } = useStore()

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <main
        className={clsx(
          'transition-all duration-300 min-h-screen flex flex-col',
          sidebarCollapsed ? 'ml-16' : 'ml-60'
        )}
      >
        <div className="flex-1">
          <Outlet />
        </div>

        {/* Footer */}
        <footer className="py-1.5 px-4 border-t border-slate-100 bg-slate-50">
          <p className="text-[10px] text-slate-300 text-center tracking-wide">
            Desarrollado por: Ing. Juan Carlos Etayo Ruiz
          </p>
        </footer>
      </main>
    </div>
  )
}
