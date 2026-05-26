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
          'transition-all duration-300 min-h-screen',
          sidebarCollapsed ? 'ml-16' : 'ml-60'
        )}
      >
        <Outlet />
      </main>
    </div>
  )
}
