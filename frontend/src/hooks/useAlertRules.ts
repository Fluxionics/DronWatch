import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api'
import { AlertRule } from '../types'
import toast from 'react-hot-toast'

export function useAlertRules() {
  return useQuery<AlertRule[]>({
    queryKey: ['alert-rules'],
    queryFn: async () => {
      const { data } = await api.get('/api/alert-rules')
      return data
    },
    refetchInterval: 60_000
  })
}

export function useCreateAlertRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<AlertRule>) => {
      const { data } = await api.post('/api/alert-rules', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alert-rules'] })
      toast.success('Alert rule created')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to create alert rule')
    }
  })
}

export function useUpdateAlertRule(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<AlertRule>) => {
      const { data } = await api.put(`/api/alert-rules/${id}`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alert-rules'] })
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to update alert rule')
    }
  })
}

export function useDeleteAlertRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/alert-rules/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alert-rules'] })
      toast.success('Alert rule deleted')
    },
    onError: () => toast.error('Failed to delete alert rule')
  })
}