import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api'
import { Monitor, MonitorStats, DowntimeEvent, Check } from '../types'
import toast from 'react-hot-toast'

export function useMonitors() {
  return useQuery<Monitor[]>({
    queryKey: ['monitors'],
    queryFn: async () => {
      const { data } = await api.get('/api/monitors')
      return data
    },
    refetchInterval: 60_000
  })
}

export function useMonitor(id: string) {
  return useQuery<Monitor>({
    queryKey: ['monitors', id],
    queryFn: async () => {
      const { data } = await api.get(`/api/monitors/${id}`)
      return data
    },
    enabled: !!id
  })
}

export function useMonitorStats(id: string, days = 7) {
  return useQuery<MonitorStats>({
    queryKey: ['monitors', id, 'stats', days],
    queryFn: async () => {
      const { data } = await api.get(`/api/monitors/${id}/stats?days=${days}`)
      return data
    },
    enabled: !!id
  })
}

export function useMonitorChecks(id: string, page = 1) {
  return useQuery<{ data: Check[]; total: number; page: number }>({
    queryKey: ['monitors', id, 'checks', page],
    queryFn: async () => {
      const { data } = await api.get(`/api/monitors/${id}/checks?page=${page}&limit=50`)
      return data
    },
    enabled: !!id
  })
}

export function useDowntimeEvents(id: string) {
  return useQuery<DowntimeEvent[]>({
    queryKey: ['monitors', id, 'downtime'],
    queryFn: async () => {
      const { data } = await api.get(`/api/monitors/${id}/downtime`)
      return data
    },
    enabled: !!id
  })
}

export function useCreateMonitor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<Monitor>) => {
      const { data } = await api.post('/api/monitors', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monitors'] })
      toast.success('Monitor created')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to create monitor')
    }
  })
}

export function useUpdateMonitor(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<Monitor>) => {
      const { data } = await api.put(`/api/monitors/${id}`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monitors'] })
      toast.success('Monitor updated')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to update monitor')
    }
  })
}

export function useDeleteMonitor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/monitors/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monitors'] })
      toast.success('Monitor deleted')
    },
    onError: () => {
      toast.error('Failed to delete monitor')
    }
  })
}

export function useToggleMonitor() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/api/monitors/${id}/toggle`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monitors'] })
    }
  })
}

export function useTestMonitor() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/api/monitors/${id}/test`)
      return data
    },
    onSuccess: (check: Check) => {
      toast.success(check.is_up ? 'Check passed — service is up' : 'Check failed — service is down')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Check failed')
    }
  })
}
