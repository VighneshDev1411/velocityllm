import { useQuery } from '@tanstack/react-query';
import { workerAPI } from '@/lib/api';
import type { WorkerMetrics, WorkerStats } from '@/types';

export function useWorkerMetrics() {
  return useQuery({
    queryKey: ['worker-metrics'],
    queryFn: async () => {
      const response = await workerAPI.getMetrics();
      return response.data as WorkerMetrics;
    },
  });
}

export function useWorkerStats() {
  return useQuery({
    queryKey: ['worker-stats'],
    queryFn: async () => {
      const response = await workerAPI.getStats();
      return response.data as WorkerStats[];
    },
  });
}

export function useWorkerHealth() {
  return useQuery({
    queryKey: ['worker-health'],
    queryFn: async () => {
      const response = await workerAPI.getHealth();
      return response.data;
    },
  });
}
