import { useQuery } from '@tanstack/react-query'
import api from '../utils/api'
import { Alert } from '../types'

export interface AlertsResponse {
  data: Alert[]
  total: number
  page: number
  limit: number
}

export function useAlerts(limit = 100) {
  return useQuery<AlertsResponse>({
    queryKey: ['alerts'],
    queryFn: async () => {
      const { data } = await api.get(`/api/alerts?limit=${limit}`)
      return data
    },
    refetchInterval: 60_000
  })
}