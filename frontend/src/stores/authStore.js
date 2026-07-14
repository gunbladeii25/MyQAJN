import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getMe } from '../services/api'

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: false,

      setAuth: (token, user) => {
        localStorage.setItem('token', token)
        set({ token, user })
      },

      logout: () => {
        localStorage.removeItem('token')
        set({ user: null, token: null })
      },

      fetchMe: async () => {
        set({ isLoading: true })
        try {
          const res = await getMe()
          set({ user: res.data.user })
        } catch {
          set({ user: null, token: null })
        } finally {
          set({ isLoading: false })
        }
      },
    }),
    { name: 'auth-storage', partialize: (s) => ({ token: s.token, user: s.user }) }
  )
)
