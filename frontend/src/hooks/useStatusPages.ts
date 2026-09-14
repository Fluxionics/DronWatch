import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api'
import { StatusPage } from '../types'
import toast from 'react-hot-toast'

export function useStatusPages() {
  return useQuery<StatusPage[]>({
    queryKey: ['status-pages'],
    queryFn: async () => {
      const { data } = await api.get('/api/status-pages')
      return data
    }
  })
}

export function useStatusPage(id: string) {
  return useQuery<StatusPage>({
    queryKey: ['status-pages', id],
    queryFn: async () => {
      const { data } = await api.get(`/api/status-pages/${id}`)
      return data
    },
    enabled: !!id
  })
}

export function usePublicStatusPage(slug: string) {
  return useQuery({
    queryKey: ['public-status', slug],
    queryFn: async () => {
      const { data } = await api.get(`/api/status-pages/public/${slug}`)
      return data
    },
    enabled: !!slug,
    refetchInterval: 60_000
  })
}

export function useCreateStatusPage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<StatusPage>) => {
      const { data } = await api.post('/api/status-pages', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['status-pages'] })
      toast.success('Status page created')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to create status page')
    }
  })
}

export function useUpdateStatusPage(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Partial<StatusPage>) => {
      const { data } = await api.put(`/api/status-pages/${id}`, payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['status-pages'] })
      toast.success('Status page updated')
    }
  })
}

export function useDeleteStatusPage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/status-pages/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['status-pages'] })
      toast.success('Status page deleted')
    }
  })
}
