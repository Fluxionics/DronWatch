import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api'

export function useIncidents() {
  return useQuery({ queryKey: ['incidents'], queryFn: async () => { const { data } = await api.get('/api/incidents'); return data }, refetchInterval: 30_000 })
}
export function useIncident(id: string) {
  return useQuery({ queryKey: ['incidents', id], queryFn: async () => { const { data } = await api.get(`/api/incidents/${id}`); return data }, enabled: !!id })
}
export function useAcknowledgeIncident() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async (id: string) => { const { data } = await api.post(`/api/incidents/${id}/acknowledge`); return data }, onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }) })
}
export function useResolveIncident() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async (id: string) => { const { data } = await api.post(`/api/incidents/${id}/resolve`); return data }, onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }) })
}
export function useMaintenance() {
  return useQuery({ queryKey: ['maintenance'], queryFn: async () => { const { data } = await api.get('/api/maintenance'); return data } })
}
export function useCreateMaintenance() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async (payload: any) => { const { data } = await api.post('/api/maintenance', payload); return data }, onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance'] }) })
}
export function useDeleteMaintenance() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async (id: string) => { await api.delete(`/api/maintenance/${id}`) }, onSuccess: () => qc.invalidateQueries({ queryKey: ['maintenance'] }) })
}
export function useSilences() {
  return useQuery({ queryKey: ['silences'], queryFn: async () => { const { data } = await api.get('/api/maintenance/silences'); return data } })
}
export function useCreateSilence() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async (payload: any) => { const { data } = await api.post('/api/maintenance/silence', payload); return data }, onSuccess: () => qc.invalidateQueries({ queryKey: ['silences'] }) })
}
export function usePatchIncident() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async ({ id, patch }: { id: string; patch: any }) => { const { data } = await api.patch(`/api/incidents/${id}`, patch); return data }, onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }) })
}
export function useIncidentAction() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async ({ id, action, message }: { id: string; action: string; message?: string }) => { const { data } = await api.post(`/api/incidents/${id}/${action}`, { message }); return data }, onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }) })
}
export function useIncidentUpdate() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async ({ id, payload }: { id: string; payload: any }) => { const { data } = await api.post(`/api/incidents/${id}/update`, payload); return data }, onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }) })
}
export function useIncidentTasks() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async ({ id, title }: { id: string; title: string }) => { const { data } = await api.post(`/api/incidents/${id}/tasks`, { title }); return data }, onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }) })
}
export function useToggleTask() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async ({ id, done }: { id: string; done: boolean }) => { const { data } = await api.patch(`/api/incidents/tasks/${id}`, { done }); return data }, onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }) })
}
export function usePostmortem() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async ({ id, payload }: { id: string; payload: any }) => { const { data } = await api.post(`/api/incidents/${id}/postmortem`, payload); return data }, onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }) })
}
