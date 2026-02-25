import { useState, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StreamingState {
  /** Accumulated text so far */
  text: string;
  /** Number of tokens received */
  tokenCount: number;
  /** Whether the stream is currently active */
  isStreaming: boolean;
  /** Error message if the stream failed */
  error: string | null;
  /** Elapsed time in ms since stream started */
  elapsedMs: number;
  /** Whether the stream completed successfully (not aborted) */
  completed: boolean;
}

export interface StreamingOptions {
  /** Model to use */
  model: string;
  /** The prompt */
  prompt: string;
  /** Max tokens to generate */
  maxTokens?: number;
  /** Sampling temperature */
  temperature?: number;
  /** Nucleus sampling */
  topP?: number;
  /** Called on each token */
  onToken?: (token: string, index: number) => void;
  /** Called when stream completes */
  onDone?: (fullText: string, tokenCount: number, elapsedMs: number) => void;
  /** Called on error */
  onError?: (error: string) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useStreaming() {
  const [state, setState] = useState<StreamingState>({
    text: '',
    tokenCount: 0,
    isStreaming: false,
    error: null,
    elapsedMs: 0,
    completed: false,
  });

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setState((prev) => ({ ...prev, isStreaming: false }));
  }, []);

  const start = useCallback(
    async (options: StreamingOptions) => {
      // Abort any existing stream
      stop();

      const controller = new AbortController();
      abortRef.current = controller;

      const startTime = Date.now();
      startTimeRef.current = startTime;

      // Reset state
      setState({
        text: '',
        tokenCount: 0,
        isStreaming: true,
        error: null,
        elapsedMs: 0,
        completed: false,
      });

      // Elapsed time ticker
      timerRef.current = setInterval(() => {
        setState((prev) => ({
          ...prev,
          elapsedMs: Date.now() - startTime,
        }));
      }, 100);

      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

      try {
        const response = await fetch(
          `${baseUrl}/api/v1/completions/stream`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: options.model,
              prompt: options.prompt,
              max_tokens: options.maxTokens ?? 1024,
              temperature: options.temperature ?? 0.7,
              top_p: options.topP ?? 1.0,
            }),
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          const errText = await response.text();
          let errMsg = `HTTP ${response.status}`;
          try {
            const errJson = JSON.parse(errText);
            errMsg = errJson.error || errJson.message || errMsg;
          } catch {
            errMsg = errText || errMsg;
          }
          throw new Error(errMsg);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';
        let tokens = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          let eventType = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              try {
                const data = JSON.parse(dataStr);

                if (eventType === 'token') {
                  const token = data.token || '';
                  fullText += token;
                  tokens++;
                  setState((prev) => ({
                    ...prev,
                    text: fullText,
                    tokenCount: tokens,
                    elapsedMs: Date.now() - startTime,
                  }));
                  options.onToken?.(token, data.index ?? tokens - 1);
                } else if (eventType === 'done') {
                  const elapsed = Date.now() - startTime;
                  setState((prev) => ({
                    ...prev,
                    text: fullText,
                    tokenCount: tokens,
                    isStreaming: false,
                    elapsedMs: elapsed,
                    completed: true,
                  }));
                  options.onDone?.(fullText, tokens, elapsed);
                } else if (eventType === 'error') {
                  const errMsg = data.message || 'Stream error';
                  setState((prev) => ({
                    ...prev,
                    isStreaming: false,
                    error: errMsg,
                    elapsedMs: Date.now() - startTime,
                  }));
                  options.onError?.(errMsg);
                }
              } catch {
                // Ignore unparseable data lines
              }
              eventType = '';
            }
          }
        }

        // If we exit the loop without a done event, mark complete
        setState((prev) => {
          if (prev.isStreaming) {
            const elapsed = Date.now() - startTime;
            options.onDone?.(fullText, tokens, elapsed);
            return { ...prev, isStreaming: false, completed: true, elapsedMs: elapsed };
          }
          return prev;
        });
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // User stopped the stream — not an error
          setState((prev) => ({
            ...prev,
            isStreaming: false,
            elapsedMs: Date.now() - startTime,
          }));
          return;
        }
        const errMsg = err.message || 'Stream failed';
        setState((prev) => ({
          ...prev,
          isStreaming: false,
          error: errMsg,
          elapsedMs: Date.now() - startTime,
        }));
        options.onError?.(errMsg);
      } finally {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        abortRef.current = null;
      }
    },
    [stop],
  );

  return { ...state, start, stop };
}
