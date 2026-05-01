// src/stores/useAIStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProvider } from '../ai/providerRegistry';
import { DAILY_CAP_CENTS } from '../ai/quotaConfig';
import type { AIProvider, ChatMessage, CustomConfig, ProviderId } from '../ai/aiProvider';

interface AIState {
  // ── Persisted ─────────────────────────────────────────────────────────────
  selectedProviderId: ProviderId;
  customConfig: CustomConfig;
  dailySpendCents: number;
  quotaResetDate: string;

  // ── Session only (not persisted — satisfies AC-0096) ──────────────────────
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingText: string;
  abortController: AbortController | null;

  // ── Actions ───────────────────────────────────────────────────────────────
  sendMessage(userText: string, fileContent: string, language: string): Promise<void>;
  cancelStream(): void;
  clearHistory(): void;
  checkAndResetQuota(): void;
  getActiveProvider(): AIProvider;
}

export const selectIsOverQuota = (s: AIState): boolean =>
  s.selectedProviderId !== 'custom' && s.dailySpendCents >= DAILY_CAP_CENTS;

const DEFAULT_CUSTOM_CONFIG: CustomConfig = {
  baseUrl: '',
  modelName: '',
  contextWindowSize: 4096,
  apiKeyIsStored: false,
};

const QUOTA_ERROR_MSG =
  '⚠ Daily AI limit reached (15¢). Resets at midnight. Switch to a Custom provider to continue without limits.';

const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      selectedProviderId: 'claude',
      customConfig: DEFAULT_CUSTOM_CONFIG,
      dailySpendCents: 0,
      quotaResetDate: new Date().toISOString().slice(0, 10),
      messages: [],
      isStreaming: false,
      streamingText: '',
      abortController: null,

      checkAndResetQuota() {
        const today = new Date().toISOString().slice(0, 10);
        if (get().quotaResetDate !== today) {
          set({ dailySpendCents: 0, quotaResetDate: today });
        }
      },

      getActiveProvider() {
        return getProvider(get().selectedProviderId, get().customConfig);
      },

      async sendMessage(userText, fileContent, language) {
        get().checkAndResetQuota();

        const pushError = (msg: string) => {
          set({
            messages: [
              ...get().messages,
              { role: 'user', content: userText },
              { role: 'assistant', content: msg },
            ],
            isStreaming: false,
            streamingText: '',
            abortController: null,
          });
        };

        if (selectIsOverQuota(get())) {
          pushError(QUOTA_ERROR_MSG);
          return;
        }

        const abort = new AbortController();
        set({
          messages: [...get().messages, { role: 'user', content: userText }],
          isStreaming: true,
          streamingText: '',
          abortController: abort,
        });

        try {
          const provider = get().getActiveProvider();

          // Pre-flight estimate — block if request would push over cap
          const estInput = Math.ceil((fileContent.length + userText.length) / 4);
          const estCost = provider.estimateCostCents(estInput, 256);
          if (
            get().selectedProviderId !== 'custom' &&
            get().dailySpendCents + estCost > DAILY_CAP_CENTS
          ) {
            // Undo the user message push
            set({ messages: get().messages.slice(0, -1) });
            pushError(QUOTA_ERROR_MSG);
            return;
          }

          let fullText = '';
          await provider.streamChat(
            get().messages,
            fileContent,
            language,
            abort.signal,
            (chunk) => {
              fullText += chunk;
              set({ streamingText: fullText });
            },
          );

          // Post-request: update with actual token estimate
          const actualCost = provider.estimateCostCents(
            Math.ceil((fileContent.length + userText.length) / 4),
            Math.ceil(fullText.length / 4),
          );

          set({
            messages: [...get().messages, { role: 'assistant', content: fullText }],
            isStreaming: false,
            streamingText: '',
            abortController: null,
            dailySpendCents: get().dailySpendCents + actualCost,
          });
        } catch (_err) {
          if (abort.signal.aborted) {
            const partial = get().streamingText;
            set({
              messages: partial
                ? [...get().messages, { role: 'assistant', content: partial }]
                : get().messages.slice(0, -1),
              isStreaming: false,
              streamingText: '',
              abortController: null,
            });
          } else {
            set({
              messages: [...get().messages, {
                role: 'assistant',
                content: '⚠ Request failed. Check your connection and try again.',
              }],
              isStreaming: false,
              streamingText: '',
              abortController: null,
            });
          }
        }
      },

      cancelStream() {
        get().abortController?.abort();
        const partial = get().streamingText;
        set({
          isStreaming: false,
          streamingText: '',
          abortController: null,
          messages: partial
            ? [...get().messages, { role: 'assistant', content: partial }]
            : get().messages,
        });
      },

      clearHistory() {
        set({ messages: [], streamingText: '' });
      },
    }),
    {
      name: 'nomadcode-ai-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        selectedProviderId: state.selectedProviderId,
        customConfig: state.customConfig,
        dailySpendCents: state.dailySpendCents,
        quotaResetDate: state.quotaResetDate,
      }),
    },
  ),
);

export default useAIStore;
