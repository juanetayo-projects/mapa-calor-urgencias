import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Profile, Filtros, NombreDia } from '@/types'

interface AppState {
  profile: Profile | null
  setProfile: (p: Profile | null) => void

  filtros: Filtros
  setFiltros: (f: Partial<Filtros>) => void
  resetFiltros: () => void

  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

const currentYear = new Date().getFullYear()

const defaultFiltros: Filtros = {
  anio: currentYear,
  mes: new Date().getMonth() + 1,
  diasSemana: [],
  semanaDelMes: null,
  triage: [],               // [] = todos los triage
  destinoClasificacion: [], // [] = todos los destinos
  ubicacionTriage: [],      // [] = todas las ubicaciones
  minutos: 30,
  vista: 'mensual',
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      profile: null,
      setProfile: (p) => set({ profile: p }),

      filtros: defaultFiltros,
      setFiltros: (f) =>
        set((s) => ({ filtros: { ...s.filtros, ...f } })),
      resetFiltros: () => set({ filtros: defaultFiltros }),

      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    {
      name: 'mcu-store',
      partialize: (s) => ({ filtros: s.filtros, sidebarCollapsed: s.sidebarCollapsed }),
      // Ensure new fields added to defaultFiltros are not lost when upgrading persisted state
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<AppState>),
        filtros: {
          ...defaultFiltros,
          ...(persisted as AppState)?.filtros,
        },
      }),
    }
  )
)
