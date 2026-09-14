import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api'
import { UserStats, ApiKey } from '../types'
import toast from 'react-hot-toast'

export function useUserStats() {
  return useQuery<UserStats>({
    queryKey: ['user', 'stats'],
    queryFn: async () => {
      const { data } = await api.get('/api/user/stats')
      return data
    },
    refetchInterval: 60_000
  })
}

export function useApiKeys() {
  return useQuery<ApiKey[]>({
    queryKey: ['user', 'api-keys'],
    queryFn: async () => {
      const { data } = await api.get('/api/user/api-keys')
      return data
    }
  })
}

export function useCreateApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (label: string) => {
      const { data } = await api.post('/api/user/api-keys', { label })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', 'api-keys'] })
      toast.success('API key created')
    }
  })
}

export function useDeleteApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/user/api-keys/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user', 'api-keys'] })
      toast.success('API key revoked')
    }
  })
}
