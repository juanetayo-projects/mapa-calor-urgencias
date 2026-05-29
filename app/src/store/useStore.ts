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
      // Migración: convierte valores string del formato antiguo a array del formato nuevo
      merge: (persisted, current) => {
        const pf = (persisted as AppState)?.filtros ?? {}
        return {
          ...current,
          ...(persisted as Partial<AppState>),
          filtros: {
            ...defaultFiltros,
            ...pf,
            // Antes eran string ('all'|valor), ahora son string[] → normalizar
            triage:               Array.isArray(pf.triage)               ? pf.triage               : [],
            destinoClasificacion: Array.isArray(pf.destinoClasificacion) ? pf.destinoClasificacion : [],
            ubicacionTriage:      Array.isArray(pf.ubicacionTriage)      ? pf.ubicacionTriage      : [],
          },
        }
      },
    }
  )
)
