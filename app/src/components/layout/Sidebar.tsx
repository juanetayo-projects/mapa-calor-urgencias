import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Upload,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useAuth } from '@/hooks/useAuth'
import { clsx } from 'clsx'

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Mapa de Calor' },
  { to: '/reportes',  icon: FileText,         label: 'Reportes' },
  { to: '/importar',  icon: Upload,            label: 'Importar datos', analystOk: true },
  { to: '/admin',     icon: Settings,          label: 'Administración', adminOnly: true },
]

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useStore()
  const { profile, signOut } = useAuth()

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 h-full bg-clinic-900 flex flex-col transition-all duration-300 z-30',
        sidebarCollapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="flex-shrink-0">
          <img src={`${import.meta.env.BASE_URL}logo-white.png`} alt="Logo" className="h-7 w-auto" />
        </div>
        {!sidebarCollapsed && (
          <div className="overflow-hidden">
            <p className="text-white font-bold text-sm leading-tight whitespace-nowrap">
              Mapa de Calor
            </p>
            <p className="text-clinic-300 text-xs whitespace-nowrap">Urgencias</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label, adminOnly, analystOk }) => {
          if (adminOnly && profile?.role !== 'admin') return null
          if (!adminOnly && !analystOk && profile?.role === 'viewer') return null
          return (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx('sidebar-link', isActive && 'active')
              }
              title={sidebarCollapsed ? label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && <span>{label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-white/10 space-y-1">
        {!sidebarCollapsed && profile && (
          <div className="px-3 py-2 mb-1">
            <p className="text-white text-sm font-medium truncate">{profile.full_name}</p>
            <span className="inline-block text-xs bg-clinic-600 text-clinic-100 rounded-full px-2 py-0.5 mt-1">
              {profile.role}
            </span>
          </div>
        )}

        <button
          onClick={signOut}
          className="sidebar-link w-full text-left"
          title={sidebarCollapsed ? 'Cerrar sesión' : undefined}
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!sidebarCollapsed && <span>Cerrar sesión</span>}
        </button>

        <button
          onClick={toggleSidebar}
          className="sidebar-link w-full text-left"
          title={sidebarCollapsed ? 'Expandir' : 'Colapsar'}
        >
          {sidebarCollapsed
            ? <ChevronRight className="w-5 h-5 flex-shrink-0" />
            : <ChevronLeft className="w-5 h-5 flex-shrink-0" />
          }
          {!sidebarCollapsed && <span>Colapsar menú</span>}
        </button>
      </div>
    </aside>
  )
}
