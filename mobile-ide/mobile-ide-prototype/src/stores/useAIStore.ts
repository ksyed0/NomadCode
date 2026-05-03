// src/stores/useAIStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProvider } from '../ai/providerRegistry';
import { DAILY_CAP_CENTS } from '../ai/quotaConfig';
import { fetchOpenRouterModels, buildPricingMap } from '../ai/openRouterModelsService';
import type {
  AIProvider, ChatMessage, BYOKConfig, OpenRouterModel, OpenRouterConfig,
} from '../ai/aiProvider';

export interface AIState {
  // ── Persisted ─────────────────────────────────────────────────────────────
  builtInModel: string;
  byokEnabled: boolean;
  byokConfig: BYOKConfig;
  dailySpendCents: number;
  quotaResetDate: string;

  // ── Session only (not persisted) ──────────────────────────────────────────
  openRouterModels: OpenRouterModel[];
  modelPricingMap: Record<string, { prompt: string; completion: string }>;
  byokKeyConfigured: boolean;
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
  loadOpenRouterModels(): Promise<void>;
  setBuiltInModel(modelId: string): void;
  setByokEnabled(enabled: boolean): void;
  setByokConfig(config: BYOKConfig): void;
  setByokKeyConfigured(configured: boolean): void;
}

const DEFAULT_BYOK_CONFIG: BYOKConfig = {
  preset: 'openrouter',
  modelName: '',
  customEndpoint: '',
  apiKeyIsStored: false,
};

export const selectIsOverQuota = (s: AIState): boolean => {
  if (s.byokEnabled) return false;
  const pricing = s.modelPricingMap[s.builtInModel];
  if (pricing && pricing.prompt === '0' && pricing.completion === '0') return false;
  return s.dailySpendCents >= DAILY_CAP_CENTS;
};

export const selectIsFreeModel = (s: AIState): boolean => {
  if (s.byokEnabled) return true;
  const pricing = s.modelPricingMap[s.builtInModel];
  return !!(pricing && pricing.prompt === '0' && pricing.completion === '0');
};

const QUOTA_ERROR_MSG =
  '⚠ Daily AI limit reached (15¢). Resets at midnight. Enable BYOK or switch to a free model to continue.';

const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      builtInModel: 'anthropic/claude-3-5-haiku',
      byokEnabled: false,
      byokConfig: DEFAULT_BYOK_CONFIG,
      dailySpendCents: 0,
      quotaResetDate: new Date().toISOString().slice(0, 10),
      openRouterModels: [],
      modelPricingMap: {},
      byokKeyConfigured: false,
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
        if (get().byokEnabled) {
          return getProvider('byok', get().byokConfig);
        }
        const orConfig: OpenRouterConfig = {
          modelId: get().builtInModel,
          pricingMap: get().modelPricingMap,
        };
        return getProvider('openrouter', orConfig);
      },

      async loadOpenRouterModels() {
        const models = await fetchOpenRouterModels();
        set({ openRouterModels: models, modelPricingMap: buildPricingMap(models) });
      },

      setBuiltInModel(modelId) { set({ builtInModel: modelId }); },
      setByokEnabled(enabled)  { set({ byokEnabled: enabled }); },
      setByokConfig(config)    { set({ byokConfig: config }); },
      setByokKeyConfigured(c)  { set({ byokKeyConfigured: c }); },

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

          const estInput = Math.ceil((fileContent.length + userText.length) / 4);
          const estCost  = provider.estimateCostCents(estInput, 256);
          if (!get().byokEnabled && get().dailySpendCents + estCost > DAILY_CAP_CENTS) {
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
      name: 'nomadcode-ai-store-v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        builtInModel:    state.builtInModel,
        byokEnabled:     state.byokEnabled,
        byokConfig:      state.byokConfig,
        dailySpendCents: state.dailySpendCents,
        quotaResetDate:  state.quotaResetDate,
      }),
    },
  ),
);

export default useAIStore;
