import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'

export function useLogin() {
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const { data } = await api.post('/api/auth/login', { username, password })
      return data
    },
    onSuccess: data => {
      setAuth(data.user, data.access, data.refresh)
      navigate('/dashboard')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Login failed')
    }
  })
}

export function useRegister() {
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: async ({ username, email, password }: { username: string; email?: string; password: string }) => {
      const { data } = await api.post('/api/auth/register', { username, email, password })
      return data
    },
    onSuccess: data => {
      setAuth(data.user, data.access, data.refresh)
      navigate('/dashboard')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Registration failed')
    }
  })
}

export function useLogout() {
  const { logout } = useAuthStore()
  const navigate = useNavigate()

  return () => {
    logout()
    navigate('/')
  }
}
