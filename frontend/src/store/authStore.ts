import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import axios from 'axios'
import { User } from '../types'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  setAuth: (user: User, access: string, refresh: string) => void
  setTokens: (access: string, refresh: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      logout: () => {
        const refresh = get().refreshToken
        set({ user: null, accessToken: null, refreshToken: null })
        if (refresh) {
          axios
            .post(`${import.meta.env.VITE_API_URL || ''}/api/auth/logout`, { refresh })
            .catch(() => {})
        }
      }
    }),
    { name: 'dronwatch-auth' }
  )
)
