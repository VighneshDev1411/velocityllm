import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

// Token counting
export function useCountTokens() {
  return useMutation({
    mutationFn: async (text: string) => {
      const response = await axios.post(`${API_BASE}/tokens/count`, { text });
      return response.data;
    },
  });
}

export function useTruncateText() {
  return useMutation({
    mutationFn: async ({ text, limit }: { text: string; limit: number }) => {
      const response = await axios.post(`${API_BASE}/tokens/truncate`, { text, limit });
      return response.data;
    },
  });
}

export function useEstimateTokens(promptTokens: number, maxTokens?: number) {
  return useQuery({
    queryKey: ['estimate-tokens', promptTokens, maxTokens],
    queryFn: async () => {
      const params = new URLSearchParams({ prompt_tokens: promptTokens.toString() });
      if (maxTokens) params.append('max_tokens', maxTokens.toString());
      const response = await axios.get(`${API_BASE}/tokens/estimate?${params}`);
      return response.data;
    },
    enabled: promptTokens > 0,
  });
}

export function useTokenCache() {
  return useQuery({
    queryKey: ['token-cache'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE}/tokens/cache`);
      return response.data;
    },
  });
}

// Context management
export function useCreateContext() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      context_id: string;
      max_tokens: number;
      system_prompt?: string;
    }) => {
      const response = await axios.post(`${API_BASE}/context/create`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contexts'] });
    },
  });
}

export function useContext(contextId: string) {
  return useQuery({
    queryKey: ['context', contextId],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE}/context/get?id=${contextId}`);
      return response.data;
    },
    enabled: !!contextId,
  });
}

export function useAddMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      context_id: string;
      role: string;
      content: string;
    }) => {
      const response = await axios.post(`${API_BASE}/context/message`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['context', variables.context_id] });
      queryClient.invalidateQueries({ queryKey: ['context-stats'] });
    },
  });
}

export function useClearContext() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contextId: string) => {
      const response = await axios.post(`${API_BASE}/context/clear`, {
        context_id: contextId,
      });
      return response.data;
    },
    onSuccess: (_, contextId) => {
      queryClient.invalidateQueries({ queryKey: ['context', contextId] });
    },
  });
}

export function useDeleteContext() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contextId: string) => {
      const response = await axios.delete(`${API_BASE}/context/delete?id=${contextId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contexts'] });
      queryClient.invalidateQueries({ queryKey: ['context-stats'] });
    },
  });
}

export function useContexts() {
  return useQuery({
    queryKey: ['contexts'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE}/context/list`);
      return response.data;
    },
  });
}

export function useContextStats() {
  return useQuery({
    queryKey: ['context-stats'],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE}/context/stats`);
      return response.data;
    },
  });
}

// Budget allocation
export function useAllocateBudget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      request_id: string;
      total_tokens: number;
      system_ratio?: number;
      prompt_ratio?: number;
      context_ratio?: number;
      response_ratio?: number;
      reserve_ratio?: number;
    }) => {
      const response = await axios.post(`${API_BASE}/budget/allocate`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
  });
}

export function useBudget(requestId: string) {
  return useQuery({
    queryKey: ['budget', requestId],
    queryFn: async () => {
      const response = await axios.get(`${API_BASE}/budget/get?id=${requestId}`);
      return response.data;
    },
    enabled: !!requestId,
  });
}

export function useTokenUsage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { request_id: string; tokens: number }) => {
      const response = await axios.post(`${API_BASE}/budget/use`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['budget', variables.request_id] });
    },
  });
}
