// src/ai/quotaConfig.ts

export const DAILY_CAP_CENTS = process.env.EXPO_PUBLIC_DAILY_CAP_CENTS
  ? Number(process.env.EXPO_PUBLIC_DAILY_CAP_CENTS)
  : 15;

export const COMPLETION_MAX_TOKENS   = 256;
export const CHAT_MAX_TOKENS         = 2048;
export const COMPLETION_PREFIX_CHARS = 1500;
export const COMPLETION_SUFFIX_CHARS = 500;
