import { useQuery } from '@tanstack/react-query';
import { analyticsAPI } from '@/lib/api';

export function useDashboardOverview() {
  return useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: async () => {
      const response = await analyticsAPI.getDashboardOverview();
      return response.data?.data;
    },
    refetchInterval: 10000, // Refresh every 10s
  });
}

export function useRequestLog(limit: number = 8) {
  return useQuery({
    queryKey: ['request-log', limit],
    queryFn: async () => {
      const response = await analyticsAPI.getRequestLog({ limit });
      return response.data?.data;
    },
    refetchInterval: 10000,
  });
}

export function useTimeSeries(period: string = '24h') {
  return useQuery({
    queryKey: ['timeseries', period],
    queryFn: async () => {
      const response = await analyticsAPI.getTimeSeries(period);
      return response.data?.data;
    },
    refetchInterval: 30000, // Refresh every 30s
  });
}

export function useModelComparison() {
  return useQuery({
    queryKey: ['model-comparison'],
    queryFn: async () => {
      const response = await analyticsAPI.getModelComparison();
      return response.data?.data;
    },
    refetchInterval: 30000,
  });
}

export function useCostBreakdown() {
  return useQuery({
    queryKey: ['cost-breakdown'],
    queryFn: async () => {
      const response = await analyticsAPI.getCostBreakdown();
      return response.data?.data;
    },
    refetchInterval: 30000,
  });
}

export function useMetricsSnapshot() {
  return useQuery({
    queryKey: ['metrics-snapshot'],
    queryFn: async () => {
      const response = await analyticsAPI.getMetricsSnapshot();
      return response.data?.data;
    },
    refetchInterval: 10000,
  });
}
