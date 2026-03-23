import { buildRuntimeAiEnvForUser, getAiSettingsForUser, normalizeAiSettings, updateAiSettingsForUser } from '../services/aiSettingsService.js';
import { testAiProviderConnection } from '../services/aiProviderTestService.js';

export async function getAiSettingsController(req, res, next) {
  try {
    const settings = await getAiSettingsForUser(req.authUser.uuid);
    res.json(settings);
  } catch (error) {
    next(error);
  }
}
export async function updateAiSettingsController(req, res, next) {
  try {
    const settings = await updateAiSettingsForUser(req.authUser.uuid, req.body || {});
    res.json(settings);
  } catch (error) {
    next(error);
  }
}

export async function getAiRuntimeSummaryController(req, res, next) {
  try {
    const env = await buildRuntimeAiEnvForUser(req.authUser.uuid);
    const providerOrder = String(env.AI_PROVIDER_ORDER || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    res.json({
      provider: env.LLM_PROVIDER,
      providerOrder,
      localFallbackDisabled: env.AI_DISABLE_OLLAMA_FALLBACK === '1',
      hasGeminiKey: Boolean(env.GEMINI_API_KEY),
      hasOpenAiKey: Boolean(env.OPENAI_API_KEY),
      hasDeepSeekKey: Boolean(env.DEEPSEEK_API_KEY),
      hasNvidiaKey: Boolean(env.NVIDIA_API_KEY),
      hasAnthropicKey: Boolean(env.ANTHROPIC_API_KEY),
      hasGroqKey: Boolean(env.GROQ_API_KEY),
      hasOpenRouterKey: Boolean(env.OPENROUTER_API_KEY),
      deepSeekModel: env.DEEPSEEK_MODEL || null,
      nvidiaModel: env.NVIDIA_MODEL || null,
      openRouterModel: env.OPENROUTER_MODEL || null,
      openRouterFallbackModels: String(env.OPENROUTER_MODEL_FALLBACKS || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      ollamaHost: env.OLLAMA_HOST || null,
      ollamaModel: env.OLLAMA_MODEL || null,
      policyVersion: process.env.AI_POLICY_VERSION || 'v1',
      promptVersion: process.env.AI_PROMPT_VERSION || 'v1',
      platformVersion: process.env.PLATFORM_VERSION || '1.0.0',
    });
  } catch (error) {
    next(error);
  }
}

export async function testAiProviderController(req, res, next) {
  try {
    const { provider, settings } = req.body || {};
    if (!provider) {
      return res.status(400).json({ ok: false, message: 'provider é obrigatório.' });
    }

    const storedSettings = await getAiSettingsForUser(req.authUser.uuid);
    const effectiveSettings = normalizeAiSettings({
      ...storedSettings,
      ...(settings || {}),
      ollama: { ...storedSettings.ollama, ...(settings?.ollama || {}) },
      gemini: { ...storedSettings.gemini, ...(settings?.gemini || {}) },
      openai: { ...storedSettings.openai, ...(settings?.openai || {}) },
      deepseek: { ...storedSettings.deepseek, ...(settings?.deepseek || {}) },
      nvidia: { ...storedSettings.nvidia, ...(settings?.nvidia || {}) },
      anthropic: { ...storedSettings.anthropic, ...(settings?.anthropic || {}) },
      groq: { ...storedSettings.groq, ...(settings?.groq || {}) },
      openrouter: { ...storedSettings.openrouter, ...(settings?.openrouter || {}) },
    });

    const result = await testAiProviderConnection(provider, effectiveSettings);
    res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    next(error);
  }
}

