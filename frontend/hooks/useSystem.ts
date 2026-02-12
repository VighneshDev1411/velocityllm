import { useQuery } from '@tanstack/react-query';
import { systemAPI, streamAPI, workerAPI } from '@/lib/api';
import type { SystemHealth, StreamMetrics } from '@/types';

export function useWorkerMetrics() {
  return useQuery({
    queryKey: ['worker-metrics'],
    queryFn: async () => {
      const response = await workerAPI.getMetrics();
      return response.data;
    },
  });
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const response = await systemAPI.getHealth();
      return response.data as SystemHealth;
    },
  });
}

export function useSystemStats() {
  return useQuery({
    queryKey: ['system-stats'],
    queryFn: async () => {
      const response = await systemAPI.getStats();
      return response.data;
    },
  });
}

export function useStreamMetrics() {
  return useQuery({
    queryKey: ['stream-metrics'],
    queryFn: async () => {
      const response = await streamAPI.getMetrics();
      return response.data as StreamMetrics;
    },
  });
}

export function useModels() {
  return useQuery({
    queryKey: ['models'],
    queryFn: async () => {
      const response = await systemAPI.listModels();
      return response.data;
    },
  });
}
