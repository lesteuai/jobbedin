export const STATUS_REASON = {
  OUT_OF_CREDIT: 'out_of_credit',
  INVALID_API_KEY: 'invalid_api_key',
} as const;

export const STATUS_REASON_MESSAGE: Record<string, string> = {
  [STATUS_REASON.OUT_OF_CREDIT]:
    'Free trial is over. Add your own OpenRouter API key in Settings, then re-analyze.',
  [STATUS_REASON.INVALID_API_KEY]:
    'Your OpenRouter API key is invalid. Update it in Settings, then re-analyze.',
};
