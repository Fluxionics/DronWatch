import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api'
import toast from 'react-hot-toast'

export interface EscalationPolicy {
  id: string
  name: string
  steps: Array<{ delay_minutes: number; channels: Array<{ type: string; target: string }> }>
  created_at: string
}

export function useEscalationPolicies() {
  return useQuery<EscalationPolicy[]>({
    queryKey: ['escalation-policies'],
    queryFn: async () => {
      const { data } = await api.get('/api/escalation-policies')
      return data
    }
  })
}

export function useCreateEscalationPolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { name: string; steps: EscalationPolicy['steps'] }) => {
      const { data } = await api.post('/api/escalation-policies', payload)
      return data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['escalation-policies'] }); toast.success('Escalation policy created') },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create policy')
  })
}

export function useDeleteEscalationPolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/api/escalation-policies/${id}`) },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['escalation-policies'] }); toast.success('Policy deleted') }
  })
}
