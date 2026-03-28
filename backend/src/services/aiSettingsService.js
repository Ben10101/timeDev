import { prisma } from '../lib/prisma.js';

const DEFAULT_AI_SETTINGS = {
  providerPreference: 'auto',
  agentAliases: {
    project_manager: 'PM Agent',
    requirements_analyst: 'Requirements Agent',
    qa_engineer: 'QA Agent',
    architect: 'Architect Agent',
    developer: 'Developer Agent',
    developer_backend: 'Developer Backend',
    developer_frontend: 'Developer Frontend',
    implementation_architect: 'UI Agent',
  },
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
  deepseek: {
    enabled: false,
    apiKey: '',
    model: 'deepseek-chat',
  },
  nvidia: {
    enabled: false,
    apiKey: '',
    model: 'qwen/qwen3.5-122b-a10b',
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
    fallbackModels: [],
  },
};

function normalizeAgentAliases(value = {}, fallback = {}) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const normalized = { ...fallback };

  for (const [key, alias] of Object.entries(source)) {
    normalized[key] = String(alias || '').trim() || fallback[key] || key;
  }

  return normalized;
}

const REMOTE_PROVIDER_KEYS = ['gemini', 'openai', 'deepseek', 'nvidia', 'anthropic', 'groq', 'openrouter'];

function normalizeProviderSettings(current = {}, fallback = {}) {
  return {
    ...fallback,
    ...current,
  };
}

function normalizeModelList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export function normalizeAiSettings(input = {}) {
  const normalizedOpenRouter = normalizeProviderSettings(input.openrouter, DEFAULT_AI_SETTINGS.openrouter);

  return {
    providerPreference: input.providerPreference || DEFAULT_AI_SETTINGS.providerPreference,
    agentAliases: normalizeAgentAliases(input.agentAliases, DEFAULT_AI_SETTINGS.agentAliases),
    ollama: normalizeProviderSettings(input.ollama, DEFAULT_AI_SETTINGS.ollama),
    gemini: normalizeProviderSettings(input.gemini, DEFAULT_AI_SETTINGS.gemini),
    openai: normalizeProviderSettings(input.openai, DEFAULT_AI_SETTINGS.openai),
    deepseek: normalizeProviderSettings(input.deepseek, DEFAULT_AI_SETTINGS.deepseek),
    nvidia: normalizeProviderSettings(input.nvidia, DEFAULT_AI_SETTINGS.nvidia),
    anthropic: normalizeProviderSettings(input.anthropic, DEFAULT_AI_SETTINGS.anthropic),
    groq: normalizeProviderSettings(input.groq, DEFAULT_AI_SETTINGS.groq),
    openrouter: {
      ...normalizedOpenRouter,
      fallbackModels: normalizeModelList(normalizedOpenRouter.fallbackModels),
    },
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
    agentAliases: { ...current.agentAliases, ...(input.agentAliases || {}) },
    ollama: { ...current.ollama, ...(input.ollama || {}) },
    gemini: { ...current.gemini, ...(input.gemini || {}) },
    openai: { ...current.openai, ...(input.openai || {}) },
    deepseek: { ...current.deepseek, ...(input.deepseek || {}) },
    nvidia: { ...current.nvidia, ...(input.nvidia || {}) },
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
  const agentName = String(options.agentName || '').trim().toLowerCase();
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
    DEEPSEEK_MODEL: settings.deepseek?.model || DEFAULT_AI_SETTINGS.deepseek.model,
    NVIDIA_MODEL: settings.nvidia?.model || DEFAULT_AI_SETTINGS.nvidia.model,
    ANTHROPIC_MODEL: settings.anthropic?.model || DEFAULT_AI_SETTINGS.anthropic.model,
    GROQ_MODEL: settings.groq?.model || DEFAULT_AI_SETTINGS.groq.model,
    OPENROUTER_MODEL: settings.openrouter?.model || DEFAULT_AI_SETTINGS.openrouter.model,
    OPENROUTER_MODEL_FALLBACKS: normalizeModelList(settings.openrouter?.fallbackModels).join(','),
  };

  if (agentName) {
    env.AI_AGENT_NAME = agentName;
  }

  if (settings.gemini?.enabled && settings.gemini?.apiKey) env.GEMINI_API_KEY = settings.gemini.apiKey;
  if (settings.openai?.enabled && settings.openai?.apiKey) env.OPENAI_API_KEY = settings.openai.apiKey;
  if (settings.deepseek?.enabled && settings.deepseek?.apiKey) env.DEEPSEEK_API_KEY = settings.deepseek.apiKey;
  if (settings.nvidia?.enabled && settings.nvidia?.apiKey) env.NVIDIA_API_KEY = settings.nvidia.apiKey;
  if (settings.anthropic?.enabled && settings.anthropic?.apiKey) env.ANTHROPIC_API_KEY = settings.anthropic.apiKey;
  if (settings.groq?.enabled && settings.groq?.apiKey) env.GROQ_API_KEY = settings.groq.apiKey;
  if (settings.openrouter?.enabled && settings.openrouter?.apiKey) env.OPENROUTER_API_KEY = settings.openrouter.apiKey;

  return env;
}

export { DEFAULT_AI_SETTINGS };
