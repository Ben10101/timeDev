import { prisma } from '../lib/prisma.js';

const DEFAULT_AI_SETTINGS = {
  providerPreference: 'auto',
  ollama: {
    enabled: true,
    host: 'http://127.0.0.1:11434',
    model: 'gemma3:4b',
  },
  gemini: {
    enabled: false,
    apiKey: '',
    model: 'gemini-2.0-flash',
  },
  openai: {
    enabled: false,
    apiKey: '',
    model: 'gpt-4.1-mini',
  },
  anthropic: {
    enabled: false,
    apiKey: '',
    model: 'claude-3-5-sonnet-latest',
  },
  groq: {
    enabled: false,
    apiKey: '',
    model: 'llama-3.3-70b-versatile',
  },
  openrouter: {
    enabled: false,
    apiKey: '',
    model: 'openai/gpt-4.1-mini',
  },
};

const REMOTE_PROVIDER_KEYS = ['gemini', 'openai', 'anthropic', 'groq', 'openrouter'];

function normalizeProviderSettings(current = {}, fallback = {}) {
  return {
    ...fallback,
    ...current,
  };
}

export function normalizeAiSettings(input = {}) {
  return {
    providerPreference: input.providerPreference || DEFAULT_AI_SETTINGS.providerPreference,
    ollama: normalizeProviderSettings(input.ollama, DEFAULT_AI_SETTINGS.ollama),
    gemini: normalizeProviderSettings(input.gemini, DEFAULT_AI_SETTINGS.gemini),
    openai: normalizeProviderSettings(input.openai, DEFAULT_AI_SETTINGS.openai),
    anthropic: normalizeProviderSettings(input.anthropic, DEFAULT_AI_SETTINGS.anthropic),
    groq: normalizeProviderSettings(input.groq, DEFAULT_AI_SETTINGS.groq),
    openrouter: normalizeProviderSettings(input.openrouter, DEFAULT_AI_SETTINGS.openrouter),
  };
}

export async function getAiSettingsForUser(userUuid) {
  const user = await prisma.user.findUnique({
    where: { uuid: userUuid },
    select: { aiSettings: true },
  });

  return normalizeAiSettings(user?.aiSettings || {});
}

export async function updateAiSettingsForUser(userUuid, input = {}) {
  const current = await getAiSettingsForUser(userUuid);
  const nextSettings = normalizeAiSettings({
    ...current,
    ...input,
    ollama: { ...current.ollama, ...(input.ollama || {}) },
    gemini: { ...current.gemini, ...(input.gemini || {}) },
    openai: { ...current.openai, ...(input.openai || {}) },
    anthropic: { ...current.anthropic, ...(input.anthropic || {}) },
    groq: { ...current.groq, ...(input.groq || {}) },
    openrouter: { ...current.openrouter, ...(input.openrouter || {}) },
  });

  await prisma.user.update({
    where: { uuid: userUuid },
    data: { aiSettings: nextSettings },
  });

  return nextSettings;
}

export async function buildRuntimeAiEnvForUser(userUuid, options = {}) {
  const settings = await getAiSettingsForUser(userUuid);
  const includeLocalFallback = options.includeLocalFallback !== false;
  const remoteProviders = REMOTE_PROVIDER_KEYS.filter(
    (providerKey) => settings[providerKey]?.enabled && settings[providerKey]?.apiKey
  );
  const preferredProvider =
    settings.providerPreference && settings.providerPreference !== 'auto' && settings.providerPreference !== 'ollama'
      ? settings.providerPreference
      : null;
  const orderedRemoteProviders = [
    ...(preferredProvider && remoteProviders.includes(preferredProvider) ? [preferredProvider] : []),
    ...remoteProviders.filter((providerKey) => providerKey !== preferredProvider),
  ];
  const providerOrder = [
    ...orderedRemoteProviders,
    ...(includeLocalFallback && settings.ollama?.enabled !== false ? ['ollama'] : []),
  ];
  const env = {
    LLM_PROVIDER: settings.providerPreference || 'auto',
    AI_PROVIDER_ORDER: providerOrder.join(','),
    AI_DISABLE_OLLAMA_FALLBACK: includeLocalFallback ? '0' : '1',
    OLLAMA_HOST: settings.ollama?.host || DEFAULT_AI_SETTINGS.ollama.host,
    OLLAMA_MODEL: settings.ollama?.model || DEFAULT_AI_SETTINGS.ollama.model,
    GEMINI_MODEL: settings.gemini?.model || DEFAULT_AI_SETTINGS.gemini.model,
    OPENAI_MODEL: settings.openai?.model || DEFAULT_AI_SETTINGS.openai.model,
    ANTHROPIC_MODEL: settings.anthropic?.model || DEFAULT_AI_SETTINGS.anthropic.model,
    GROQ_MODEL: settings.groq?.model || DEFAULT_AI_SETTINGS.groq.model,
    OPENROUTER_MODEL: settings.openrouter?.model || DEFAULT_AI_SETTINGS.openrouter.model,
  };

  if (settings.gemini?.enabled && settings.gemini?.apiKey) env.GEMINI_API_KEY = settings.gemini.apiKey;
  if (settings.openai?.enabled && settings.openai?.apiKey) env.OPENAI_API_KEY = settings.openai.apiKey;
  if (settings.anthropic?.enabled && settings.anthropic?.apiKey) env.ANTHROPIC_API_KEY = settings.anthropic.apiKey;
  if (settings.groq?.enabled && settings.groq?.apiKey) env.GROQ_API_KEY = settings.groq.apiKey;
  if (settings.openrouter?.enabled && settings.openrouter?.apiKey) env.OPENROUTER_API_KEY = settings.openrouter.apiKey;

  return env;
}

export { DEFAULT_AI_SETTINGS };
