import { useEffect, useMemo, useRef, useState, useCallback } from 'react';

declare global {
  interface Window {
    marketbot: {
      getGatewayToken: () => Promise<string>;
      getGatewayUrl: () => Promise<string>;
      getWebviewPreloadPath: () => Promise<string>;
      restartGateway: () => Promise<void>;
      openExternal: (url: string) => Promise<void>;
      onGatewayStatus: (handler: (status: { running: boolean }) => void) => void;
      readConfig: () => Promise<Record<string, unknown>>;
      writeConfig: (patch: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
      checkOnboarding: () => Promise<{ needsOnboarding: boolean }>;
      markOnboardingDone: () => Promise<{ ok: boolean; error?: string }>;
      writeCredentials: (args: { profileId: string; provider: string; apiKey: string }) =>
        Promise<{ ok: boolean; error?: string }>;
      // Ollama local model management.
      checkOllama: () => Promise<{ available: boolean; models: string[] }>;
      pullOllamaModel: (modelId: string) => Promise<{ ok: boolean; error?: string }>;
      setOllamaModel: (modelId: string) => Promise<{ ok: boolean; error?: string }>;
      onOllamaPullProgress: (handler: (progress: {
        model: string;
        status: string;
        completed?: number;
        total?: number;
        percent?: number;
        done?: boolean;
        error?: string;
      }) => void) => () => void;
    };
  }
}

// ── Navigation ──

type TabId =
  | 'chat'
  | 'desk'
  | 'stocks'
  | 'runs'
  | 'overview'
  | 'config'
  | 'channels'
  | 'sessions'
  | 'cron'
  | 'logs'
  | 'models';

interface NavTab {
  id: TabId;
  label: string;
  path: string;
  icon: string;
}

interface NavGroup {
  label: string;
  tabs: NavTab[];
}

const TABS: Record<TabId, NavTab> = {
  chat: {
    id: 'chat',
    label: 'Chat',
    path: '/chat',
    icon: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 5h12M4 8.5h8M4 12h10"/><path d="M3 3h14a1 1 0 011 1v9a1 1 0 01-1 1H7l-4 3V4a1 1 0 011-1z"/></svg>',
  },
  desk: {
    id: 'desk',
    label: 'Desk',
    path: '/desk',
    icon: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="16" height="12" rx="2"/><path d="M7 18h6M10 15v3"/></svg>',
  },
  stocks: {
    id: 'stocks',
    label: 'Stocks',
    path: '/stocks',
    icon: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 17l4-6 3 3 4-7 3 4"/></svg>',
  },
  runs: {
    id: 'runs',
    label: 'Runs',
    path: '/runs',
    icon: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 4l10 6-10 6V4z"/></svg>',
  },
  overview: {
    id: 'overview',
    label: 'Connection',
    path: '/overview',
    icon: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="3"/><path d="M10 3v2M10 15v2M3 10h2M15 10h2M5.05 5.05l1.41 1.41M13.54 13.54l1.41 1.41M5.05 14.95l1.41-1.41M13.54 6.46l1.41-1.41"/></svg>',
  },
  config: {
    id: 'config',
    label: 'Config',
    path: '/config',
    icon: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="2.5"/><path d="M10 2v3M10 15v3M2 10h3M15 10h3M4.22 4.22l2.12 2.12M13.66 13.66l2.12 2.12M4.22 15.78l2.12-2.12M13.66 6.34l2.12-2.12"/></svg>',
  },
  channels: {
    id: 'channels',
    label: 'Channels',
    path: '/channels',
    icon: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 2l-2 16M15 2l-2 16M3 7h16M2 13h16"/></svg>',
  },
  sessions: {
    id: 'sessions',
    label: 'Sessions',
    path: '/sessions',
    icon: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="14" height="13" rx="1.5"/><path d="M3 8h14M7 4V2M13 4V2"/></svg>',
  },
  cron: {
    id: 'cron',
    label: 'Cron Jobs',
    path: '/cron',
    icon: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="7.5"/><path d="M10 5v5l3 3"/></svg>',
  },
  logs: {
    id: 'logs',
    label: 'Logs',
    path: '/logs',
    icon: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="2" width="14" height="16" rx="1.5"/><path d="M7 6h6M7 10h6M7 14h4"/></svg>',
  },
  models: {
    id: 'models',
    label: 'AI Models',
    path: '/models',
    icon: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 2l7 4v8l-7 4-7-4V6l7-4z"/><path d="M10 10l7-4M10 10v8M10 10L3 6"/></svg>',
  },
};

const NAV_GROUPS: NavGroup[] = [
  { label: 'Chat', tabs: [TABS.chat] },
  { label: 'Finance', tabs: [TABS.desk, TABS.stocks, TABS.runs] },
  {
    label: 'Control',
    tabs: [TABS.overview, TABS.config, TABS.channels, TABS.sessions, TABS.cron, TABS.logs],
  },
  { label: 'Settings', tabs: [TABS.models] },
];

// ── Helpers ──

function normalizeBase(url: string) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function buildTabUrl(base: string, path: string, token: string) {
  const normalized = normalizeBase(base);
  const url = `${normalized}${path}`;
  const params = new URLSearchParams();
  if (token.trim()) params.set('token', token.trim());
  params.set('embed', '1');
  return `${url}?${params.toString()}`;
}

function injectTokenToWebview(webview: HTMLElement & { executeJavaScript: (code: string, userGesture?: boolean) => Promise<unknown> }, token: string) {
  if (!token.trim()) return;
  const script = `(() => {
    const KEY = "marketbot.control.settings.v1";
    const raw = localStorage.getItem(KEY);
    let next = {};
    try { if (raw) next = JSON.parse(raw); } catch {}
    next.token = "${token.replace(/"/g, '\\"')}";
    localStorage.setItem(KEY, JSON.stringify(next));
    localStorage.removeItem("marketbot.device.auth.v1");
    return true;
  })();`;
  webview.executeJavaScript(script, true).catch(() => undefined);
}

// ── Boot phases ──

type BootPhase = 'init' | 'onboarding' | 'starting' | 'connecting' | 'ready';

// ── Provider definitions for the onboarding wizard ──

interface ProviderDef {
  id: string;
  label: string;
  profileId: string;
  defaultModel: string;
  placeholder: string;
  hint: string;
  color: string;
}

const PROVIDERS: ProviderDef[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    profileId: 'anthropic:default',
    defaultModel: 'anthropic/claude-sonnet-4-5',
    placeholder: 'sk-ant-...',
    hint: 'Get your key at console.anthropic.com',
    color: '#d4a27f',
  },
  {
    id: 'openai-codex',
    label: 'OpenAI',
    profileId: 'openai-codex:default',
    defaultModel: 'openai/gpt-5.2',
    placeholder: 'sk-...',
    hint: 'Get your key at platform.openai.com',
    color: '#74aa9c',
  },
  {
    id: 'google',
    label: 'Google',
    profileId: 'google:default',
    defaultModel: 'google/gemini-3-pro-preview',
    placeholder: 'AIza...',
    hint: 'Get your key at aistudio.google.com',
    color: '#4285f4',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    profileId: 'deepseek:default',
    defaultModel: 'deepseek/deepseek-chat',
    placeholder: 'sk-...',
    hint: 'Get your key at platform.deepseek.com',
    color: '#4d9de0',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    profileId: 'openrouter:default',
    defaultModel: 'openrouter/auto',
    placeholder: 'sk-or-...',
    hint: 'Get your key at openrouter.ai',
    color: '#6c5ce7',
  },
  {
    id: 'groq',
    label: 'Groq',
    profileId: 'groq:default',
    defaultModel: 'groq/llama-3.1-70b-versatile',
    placeholder: 'gsk_...',
    hint: 'Get your key at console.groq.com',
    color: '#f56565',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    profileId: 'mistral:default',
    defaultModel: 'mistral/mistral-large-latest',
    placeholder: '...',
    hint: 'Get your key at console.mistral.ai',
    color: '#ff7000',
  },
  {
    id: 'xai',
    label: 'xAI (Grok)',
    profileId: 'xai:default',
    defaultModel: 'xai/grok-beta',
    placeholder: 'xai-...',
    hint: 'Get your key at console.x.ai',
    color: '#1da1f2',
  },
];

// ── Local Model Definitions ──

interface LocalModelDef {
  id: string;        // ollama model ID (e.g. "qwen3:0.6b")
  name: string;      // display name
  size: string;      // approximate download size
  contextWindow: number;
  description: string;
}

const LOCAL_MODELS: LocalModelDef[] = [
  {
    id: 'qwen3:0.6b',
    name: 'Qwen3-0.6B',
    size: '~400MB',
    contextWindow: 32768,
    description: 'Ultra-lightweight, fast responses',
  },
  {
    id: 'qwen3:4b',
    name: 'Qwen3-4B-Instruct',
    size: '~2.5GB',
    contextWindow: 32768,
    description: 'Balanced speed and quality',
  },
  {
    id: 'qwen3:8b',
    name: 'Qwen3-8B',
    size: '~4.9GB',
    contextWindow: 128000,
    description: 'Strong reasoning capability',
  },
  {
    id: 'qwen3:32b',
    name: 'Qwen3-32B',
    size: '~19GB',
    contextWindow: 128000,
    description: 'Best quality, requires more RAM',
  },
];

// ── Onboarding Wizard ──

type OnboardingStep = 'welcome' | 'provider' | 'apikey' | 'done';

function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [selectedProvider, setSelectedProvider] = useState<ProviderDef | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleProviderSelect = useCallback((provider: ProviderDef) => {
    setSelectedProvider(provider);
    setApiKey('');
    setError('');
    setStep('apikey');
  }, []);

  const handleBack = useCallback(() => {
    if (step === 'apikey') {
      setStep('provider');
      setError('');
    } else if (step === 'provider') {
      setStep('welcome');
    }
  }, [step]);

  const handleSaveKey = useCallback(async () => {
    if (!selectedProvider || !apiKey.trim()) return;
    setSaving(true);
    setError('');

    try {
      // Write credentials to the auth-profiles store.
      const credResult = await window.marketbot.writeCredentials({
        profileId: selectedProvider.profileId,
        provider: selectedProvider.id,
        apiKey: apiKey.trim(),
      });
      if (!credResult.ok) {
        setError(credResult.error || 'Failed to save credentials');
        setSaving(false);
        return;
      }

      // Write the default model to config.
      const configResult = await window.marketbot.writeConfig({
        agents: {
          defaults: {
            model: { primary: selectedProvider.defaultModel },
          },
        },
      });
      if (!configResult.ok) {
        setError(configResult.error || 'Failed to save config');
        setSaving(false);
        return;
      }

      // Mark onboarding as complete.
      await window.marketbot.markOnboardingDone();

      setStep('done');
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }, [selectedProvider, apiKey]);

  const handleFinish = useCallback(async () => {
    // Restart gateway so it picks up the new credentials.
    await window.marketbot.restartGateway();
    onComplete();
  }, [onComplete]);

  return (
    <div className="onboarding">
      <div className="onboarding-container">
        {/* Progress dots */}
        <div className="onboarding-progress">
          {(['welcome', 'provider', 'apikey', 'done'] as OnboardingStep[]).map((s, i) => (
            <div
              key={s}
              className={`progress-dot${step === s ? ' active' : ''}${
                ['welcome', 'provider', 'apikey', 'done'].indexOf(step) > i ? ' completed' : ''
              }`}
            />
          ))}
        </div>

        {step === 'welcome' && (
          <div className="onboarding-step fade-in">
            <div className="onboarding-logo">
              <div className="onboarding-logo-inner">MB</div>
            </div>
            <h1 className="onboarding-title">Welcome to MarketBot</h1>
            <p className="onboarding-desc">
              Your autonomous financial analysis agent. Let&apos;s get you set up
              with an AI provider to get started.
            </p>
            <button className="primary onboarding-btn" onClick={() => setStep('provider')}>
              Get Started
            </button>
          </div>
        )}

        {step === 'provider' && (
          <div className="onboarding-step fade-in">
            <h2 className="onboarding-step-title">Choose Your AI Provider</h2>
            <p className="onboarding-desc">
              Select the provider you&apos;d like to use. You can change this later in Settings.
            </p>
            <div className="provider-grid">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  className="provider-card"
                  onClick={() => handleProviderSelect(p)}
                >
                  <div className="provider-badge" style={{ background: p.color }}>
                    {p.label.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="provider-name">{p.label}</div>
                </button>
              ))}
            </div>
            <button className="ghost onboarding-back" onClick={handleBack}>
              Back
            </button>
          </div>
        )}

        {step === 'apikey' && selectedProvider && (
          <div className="onboarding-step fade-in">
            <h2 className="onboarding-step-title">Enter API Key</h2>
            <p className="onboarding-desc">
              Paste your <strong>{selectedProvider.label}</strong> API key below.
            </p>
            <div className="apikey-input-wrap">
              <input
                type="password"
                className="apikey-input"
                placeholder={selectedProvider.placeholder}
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setError(''); }}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter' && apiKey.trim()) handleSaveKey(); }}
              />
              <p className="apikey-hint">{selectedProvider.hint}</p>
            </div>
            {error && <div className="onboarding-error">{error}</div>}
            <div className="onboarding-actions">
              <button className="ghost" onClick={handleBack}>Back</button>
              <button
                className="primary"
                onClick={handleSaveKey}
                disabled={!apiKey.trim() || saving}
              >
                {saving ? 'Saving...' : 'Save & Continue'}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="onboarding-step fade-in">
            <div className="onboarding-check">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 12l3 3 5-6" />
              </svg>
            </div>
            <h2 className="onboarding-step-title">You&apos;re All Set</h2>
            <p className="onboarding-desc">
              MarketBot is configured with <strong>{selectedProvider?.label}</strong>.
              The gateway will restart with your new credentials.
            </p>
            <button className="primary onboarding-btn" onClick={handleFinish}>
              Start Using MarketBot
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Model Settings Panel ──

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  reasoning?: boolean;
}

function ModelSettings({
  gatewayUrl,
  gatewayToken: _gatewayToken,
  running,
}: {
  gatewayUrl: string;
  gatewayToken: string;
  running: boolean;
}) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [primaryModel, setPrimaryModel] = useState('');
  const [fallbacks, setFallbacks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Provider key editing state
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [editKey, setEditKey] = useState('');
  const [keySaving, setKeySaving] = useState(false);
  const [keyError, setKeyError] = useState('');
  const [keySuccess, setKeySuccess] = useState('');

  // Local model state
  const [ollamaAvailable, setOllamaAvailable] = useState(false);
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [pullPercent, setPullPercent] = useState(0);
  const [pullStatus, setPullStatus] = useState('');
  const [pullError, setPullError] = useState('');
  // Track which providers have configured keys (best-effort from models.list)
  const [configuredProviders, setConfiguredProviders] = useState<Set<string>>(new Set());

  const base = normalizeBase(gatewayUrl);

  const rpc = useCallback(
    async (method: string, params: Record<string, unknown> = {}) => {
      const res = await fetch(`${base}/api/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params }),
      });
      if (!res.ok) throw new Error(`RPC ${method} failed: ${res.status}`);
      return res.json();
    },
    [base],
  );

  // Fetch models + current config.
  // showSpinner=true on first load, false on background refreshes to avoid
  // unmounting the UI and losing local-model state.
  const fetchData = useCallback(async (showSpinner = false) => {
    if (!running) return;
    if (showSpinner) setLoading(true);
    setError('');
    try {
      const [modelsRes, configRes] = await Promise.all([
        rpc('models.list'),
        rpc('config.get'),
      ]);

      const modelList: ModelInfo[] = modelsRes?.models ?? [];
      setModels(modelList);

      // Determine configured providers from the model list
      const providerIds = new Set(modelList.map((m) => m.provider));
      setConfiguredProviders(providerIds);

      // Extract current primary model from config
      const agentModel = (configRes as Record<string, unknown>)?.agents as
        | Record<string, unknown>
        | undefined;
      const defaults = agentModel?.defaults as Record<string, unknown> | undefined;
      const model = defaults?.model as Record<string, unknown> | undefined;
      const primary = (model?.primary as string) ?? '';
      const fb = (model?.fallbacks as string[]) ?? [];
      setPrimaryModel(primary);
      setFallbacks(fb);
    } catch {
      // Silently ignore refresh errors (gateway may be restarting).
      if (showSpinner) setError('Failed to load models');
    } finally {
      setLoading(false);
    }
  }, [running, rpc]);

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Check ollama availability and listen for pull progress.
  const checkOllamaStatus = useCallback(async () => {
    try {
      const result = await window.marketbot.checkOllama();
      setOllamaAvailable(result.available);
      setInstalledModels(result.models);
    } catch {
      setOllamaAvailable(false);
    }
  }, []);

  useEffect(() => {
    checkOllamaStatus();
  }, [checkOllamaStatus]);

  useEffect(() => {
    const cleanup = window.marketbot.onOllamaPullProgress((progress) => {
      if (progress.done) {
        setPullingModel(null);
        setPullPercent(0);
        setPullStatus('');
        if (progress.error) {
          setPullError(progress.error);
        } else {
          setPullError('');
          // Refresh installed models list.
          checkOllamaStatus();
          // Background-refresh model list from gateway after a delay
          // (no spinner so the UI stays stable).
          setTimeout(() => {
            window.marketbot.restartGateway();
            setTimeout(() => fetchData(), 5000);
          }, 1000);
        }
      } else {
        setPullStatus(progress.status || '');
        if (progress.percent !== undefined) {
          setPullPercent(progress.percent);
        }
      }
    });
    return cleanup;
  }, [checkOllamaStatus, fetchData]);

  // Pull a local model via ollama.
  const handlePullModel = useCallback(async (modelId: string) => {
    setPullingModel(modelId);
    setPullPercent(0);
    setPullStatus('Starting download...');
    setPullError('');
    const result = await window.marketbot.pullOllamaModel(modelId);
    if (!result.ok) {
      setPullError(result.error || 'Failed to pull model');
      setPullingModel(null);
    }
  }, []);

  // Set a local model as primary.
  const handleSetLocalPrimary = useCallback(async (modelId: string) => {
    setSaving(true);
    setSaveMsg('');
    try {
      // Write to config file via IPC (for persistence).
      const result = await window.marketbot.setOllamaModel(modelId);
      if (!result.ok) {
        setSaveMsg(`Error: ${result.error}`);
        return;
      }
      setPrimaryModel(`ollama/${modelId}`);
      setSaveMsg(`Primary model set to ollama/${modelId}`);
      // Tell the gateway to reload config via RPC.
      try {
        await rpc('config.patch', {
          patch: { agents: { defaults: { model: { primary: `ollama/${modelId}` } } } },
        });
      } catch {
        // Fallback if RPC unavailable.
        await window.marketbot.restartGateway();
      }
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setSaveMsg(`Error: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  }, [rpc]);

  // Group models by provider for the dropdown, merging installed local models.
  const groupedModels = useMemo(() => {
    const groups: Record<string, ModelInfo[]> = {};
    for (const m of models) {
      const key = m.provider || 'unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    }

    // Ensure installed ollama local models always appear in the dropdown,
    // even if the gateway hasn't discovered them yet.
    const existingOllamaIds = new Set(
      (groups['ollama'] || []).map((m) => m.id),
    );
    for (const lm of LOCAL_MODELS) {
      const isInstalled = installedModels.some(
        (m) => m === lm.id || m === `${lm.id}:latest` || m.startsWith(`${lm.id}:`),
      );
      if (isInstalled && !existingOllamaIds.has(`ollama/${lm.id}`)) {
        if (!groups['ollama']) groups['ollama'] = [];
        groups['ollama'].push({
          id: `ollama/${lm.id}`,
          name: `${lm.name} (Local)`,
          provider: 'ollama',
          contextWindow: lm.contextWindow,
        });
      }
    }

    return groups;
  }, [models, installedModels]);

  // Change primary model via config.patch
  const handlePrimaryChange = useCallback(
    async (newModel: string) => {
      if (!newModel || newModel === primaryModel) return;
      setSaving(true);
      setSaveMsg('');
      try {
        await rpc('config.patch', {
          patch: {
            agents: { defaults: { model: { primary: newModel } } },
          },
        });
        setPrimaryModel(newModel);
        setSaveMsg('Primary model updated');
        setTimeout(() => setSaveMsg(''), 3000);
      } catch (err) {
        setSaveMsg(`Error: ${String(err)}`);
      } finally {
        setSaving(false);
      }
    },
    [primaryModel, rpc],
  );

  // Remove a fallback
  const removeFallback = useCallback(
    async (idx: number) => {
      const next = fallbacks.filter((_, i) => i !== idx);
      setSaving(true);
      try {
        await rpc('config.patch', {
          patch: {
            agents: { defaults: { model: { fallbacks: next } } },
          },
        });
        setFallbacks(next);
      } catch (err) {
        setSaveMsg(`Error: ${String(err)}`);
      } finally {
        setSaving(false);
      }
    },
    [fallbacks, rpc],
  );

  // Add a fallback
  const addFallback = useCallback(
    async (modelId: string) => {
      if (!modelId || fallbacks.includes(modelId)) return;
      const next = [...fallbacks, modelId];
      setSaving(true);
      try {
        await rpc('config.patch', {
          patch: {
            agents: { defaults: { model: { fallbacks: next } } },
          },
        });
        setFallbacks(next);
      } catch (err) {
        setSaveMsg(`Error: ${String(err)}`);
      } finally {
        setSaving(false);
      }
    },
    [fallbacks, rpc],
  );

  // Save API key for a provider
  const handleSaveKey = useCallback(
    async (provider: ProviderDef) => {
      if (!editKey.trim()) return;
      setKeySaving(true);
      setKeyError('');
      setKeySuccess('');
      try {
        const result = await window.marketbot.writeCredentials({
          profileId: provider.profileId,
          provider: provider.id,
          apiKey: editKey.trim(),
        });
        if (!result.ok) {
          setKeyError(result.error || 'Failed to save key');
          return;
        }
        setKeySuccess('Key saved. Restarting gateway...');
        setEditKey('');
        // Trigger gateway restart via RPC so it reloads auth-profiles.
        // This works even when the desktop app is piggybacking on an
        // external (CLI-started) gateway, unlike the IPC restartGateway
        // which only kills/restarts processes the desktop spawned itself.
        try {
          await window.marketbot.restartGateway();
        } catch {
          // Ignore restart errors; the gateway may already be restarting.
        }
        setKeySuccess('Key saved and gateway restarted');
        setTimeout(() => {
          setEditingProvider(null);
          setKeySuccess('');
          // Re-fetch with refresh=true to bust the model catalog cache
          // so newly-configured providers appear immediately.
          setTimeout(async () => {
            try {
              await rpc('models.list', { refresh: true });
            } catch {
              // ignore; fetchData below will retry with cache
            }
            fetchData();
          }, 4000);
        }, 1500);
      } catch (err) {
        setKeyError(String(err));
      } finally {
        setKeySaving(false);
      }
    },
    [editKey, fetchData, rpc],
  );

  if (!running) {
    return (
      <div className="ms-panel">
        <div className="ms-header">
          <h1 className="ms-title">AI Models</h1>
        </div>
        <div className="ms-offline">
          <p>Gateway is offline. Settings will load once connected.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="ms-panel">
        <div className="ms-header">
          <h1 className="ms-title">AI Models</h1>
        </div>
        <div className="ms-loading">
          <div className="loading-progress" style={{ width: 120 }}>
            <div className="loading-progress-bar" />
          </div>
          <span>Loading models...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="ms-panel">
      <div className="ms-header">
        <h1 className="ms-title">AI Models</h1>
        <button className="ghost ms-refresh" onClick={() => fetchData(true)} title="Refresh">
          <span
            className="nav-icon"
            dangerouslySetInnerHTML={{
              __html:
                '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 10a7 7 0 0113.36-2.83M17 10a7 7 0 01-13.36 2.83"/><path d="M16.5 3v4.5H12M3.5 17v-4.5H8"/></svg>',
            }}
          />
        </button>
      </div>

      {error && <div className="ms-error">{error}</div>}

      {/* ── Local Models ── */}
      <section className="ms-section">
        <h2 className="ms-section-title">Local Models</h2>
        <p className="ms-section-desc">
          Run AI models locally via Ollama. No API key required, completely private.
        </p>

        {!ollamaAvailable && (
          <div className="ms-local-warning">
            <span className="ms-local-warning-icon">!</span>
            <div>
              <strong>Ollama not detected</strong>
              <p>
                Install Ollama from{' '}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    window.marketbot.openExternal('https://ollama.com');
                  }}
                >
                  ollama.com
                </a>{' '}
                and make sure it is running.
              </p>
              <button className="ghost ms-local-retry" onClick={checkOllamaStatus}>
                Retry
              </button>
            </div>
          </div>
        )}

        {pullError && <div className="ms-local-error">{pullError}</div>}

        <div className="ms-local-grid">
          {LOCAL_MODELS.map((lm) => {
            // Normalize: installed model names may have trailing ":latest"
            const isInstalled = installedModels.some(
              (m) => m === lm.id || m === `${lm.id}:latest` || m.startsWith(`${lm.id}:`),
            );
            const isPulling = pullingModel === lm.id;
            const isPrimary = primaryModel === `ollama/${lm.id}`;

            return (
              <div
                key={lm.id}
                className={`ms-local-card${isInstalled ? ' installed' : ''}${isPrimary ? ' primary' : ''}`}
              >
                <div className="ms-local-card-header">
                  <div className="ms-local-card-name">{lm.name}</div>
                  <div className="ms-local-card-size">{lm.size}</div>
                </div>
                <div className="ms-local-card-desc">{lm.description}</div>
                <div className="ms-local-card-meta">
                  Context: {Math.round(lm.contextWindow / 1000)}k tokens
                </div>

                {isPulling ? (
                  <div className="ms-local-progress-wrap">
                    <div className="ms-local-progress-bar">
                      <div
                        className="ms-local-progress-fill"
                        style={{ width: `${pullPercent}%` }}
                      />
                    </div>
                    <div className="ms-local-progress-text">
                      {pullPercent > 0 ? `${pullPercent}%` : pullStatus}
                    </div>
                  </div>
                ) : isInstalled ? (
                  <div className="ms-local-card-actions">
                    <span className="ms-local-installed-badge">Installed</span>
                    {isPrimary ? (
                      <span className="ms-local-primary-badge">Primary</span>
                    ) : (
                      <button
                        className="ms-local-set-primary"
                        onClick={() => handleSetLocalPrimary(lm.id)}
                        disabled={saving}
                      >
                        Set as Primary
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    className="ms-local-install-btn"
                    onClick={() => handlePullModel(lm.id)}
                    disabled={!ollamaAvailable || pullingModel !== null}
                  >
                    Install
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Primary Model ── */}
      <section className="ms-section">
        <h2 className="ms-section-title">Primary Model</h2>
        <p className="ms-section-desc">
          The default model used for all conversations and analysis.
        </p>
        <div className="ms-model-select-wrap">
          <select
            className="ms-model-select"
            value={primaryModel}
            onChange={(e) => handlePrimaryChange(e.target.value)}
            disabled={saving}
          >
            {!primaryModel && <option value="">Select a model</option>}
            {Object.entries(groupedModels).map(([provider, providerModels]) => (
              <optgroup key={provider} label={provider}>
                {providerModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.id}
                    {m.contextWindow ? ` (${Math.round(m.contextWindow / 1000)}k)` : ''}
                    {m.reasoning ? ' [reasoning]' : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {primaryModel && (
            <div className="ms-current-badge">{primaryModel}</div>
          )}
        </div>
        {saveMsg && (
          <div className={`ms-save-msg${saveMsg.startsWith('Error') ? ' error' : ''}`}>
            {saveMsg}
          </div>
        )}
      </section>

      {/* ── Fallback Models ── */}
      <section className="ms-section">
        <h2 className="ms-section-title">Fallback Models</h2>
        <p className="ms-section-desc">
          Used when the primary model is unavailable. Tried in order.
        </p>
        <div className="ms-fallback-list">
          {fallbacks.length === 0 && (
            <div className="ms-fallback-empty">No fallback models configured.</div>
          )}
          {fallbacks.map((fb, idx) => (
            <div key={fb} className="ms-fallback-item">
              <span className="ms-fallback-rank">{idx + 1}</span>
              <span className="ms-fallback-name">{fb}</span>
              <button
                className="ms-fallback-remove"
                onClick={() => removeFallback(idx)}
                title="Remove"
                disabled={saving}
              >
                x
              </button>
            </div>
          ))}
        </div>
        {models.length > 0 && (
          <div className="ms-fallback-add">
            <select
              className="ms-model-select small"
              defaultValue=""
              onChange={(e) => {
                addFallback(e.target.value);
                e.target.value = '';
              }}
              disabled={saving}
            >
              <option value="" disabled>
                Add fallback...
              </option>
              {Object.entries(groupedModels).map(([provider, providerModels]) => (
                <optgroup key={provider} label={provider}>
                  {providerModels
                    .filter((m) => m.id !== primaryModel && !fallbacks.includes(m.id))
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name || m.id}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>
        )}
      </section>

      {/* ── API Keys / Providers ── */}
      <section className="ms-section">
        <h2 className="ms-section-title">API Keys</h2>
        <p className="ms-section-desc">
          Manage credentials for each AI provider. Keys are stored locally.
        </p>
        <div className="ms-provider-grid">
          {PROVIDERS.map((p) => {
            const isConfigured = configuredProviders.has(p.id);
            const isEditing = editingProvider === p.id;

            return (
              <div key={p.id} className={`ms-provider-card${isConfigured ? ' configured' : ''}`}>
                <div className="ms-provider-top">
                  <div className="ms-provider-badge" style={{ background: p.color }}>
                    {p.label.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="ms-provider-info">
                    <div className="ms-provider-name">{p.label}</div>
                    <div className={`ms-provider-status${isConfigured ? ' ok' : ''}`}>
                      {isConfigured ? 'Configured' : 'Not configured'}
                    </div>
                  </div>
                  <button
                    className="ghost ms-provider-edit"
                    onClick={() => {
                      if (isEditing) {
                        setEditingProvider(null);
                        setEditKey('');
                        setKeyError('');
                        setKeySuccess('');
                      } else {
                        setEditingProvider(p.id);
                        setEditKey('');
                        setKeyError('');
                        setKeySuccess('');
                      }
                    }}
                  >
                    {isEditing ? 'Cancel' : isConfigured ? 'Change' : 'Add Key'}
                  </button>
                </div>
                {isEditing && (
                  <div className="ms-provider-edit-form fade-in">
                    <input
                      type="password"
                      className="apikey-input"
                      placeholder={p.placeholder}
                      value={editKey}
                      onChange={(e) => {
                        setEditKey(e.target.value);
                        setKeyError('');
                      }}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editKey.trim()) handleSaveKey(p);
                      }}
                    />
                    <p className="apikey-hint">{p.hint}</p>
                    {keyError && <div className="ms-key-error">{keyError}</div>}
                    {keySuccess && <div className="ms-key-success">{keySuccess}</div>}
                    <button
                      className="primary ms-key-save"
                      onClick={() => handleSaveKey(p)}
                      disabled={!editKey.trim() || keySaving}
                    >
                      {keySaving ? 'Saving...' : 'Save Key'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ── App Component ──

export default function App() {
  const [phase, setPhase] = useState<BootPhase>('init');
  const [running, setRunning] = useState(false);
  const [gatewayUrl, setGatewayUrl] = useState('');
  const [gatewayToken, setGatewayToken] = useState('');
  const [webviewPreload, setWebviewPreload] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const webviewRef = useRef<(HTMLElement & { loadURL: (url: string) => void; reload: () => void; executeJavaScript: (code: string, userGesture?: boolean) => Promise<unknown> }) | null>(null);
  const prevUrlRef = useRef('');

  // Phase 1: Fetch config from main process, then check onboarding.
  useEffect(() => {
    let mounted = true;
    setPhase('init');

    Promise.all([
      window.marketbot?.getGatewayToken(),
      window.marketbot?.getGatewayUrl(),
      window.marketbot?.getWebviewPreloadPath(),
    ]).then(async ([token, url, preload]) => {
      if (!mounted) return;
      setGatewayToken(token || '');
      setGatewayUrl(url || 'http://127.0.0.1:18789/');
      setWebviewPreload(preload || '');

      // Check if onboarding is needed before proceeding.
      try {
        const { needsOnboarding } = await window.marketbot.checkOnboarding();
        if (!mounted) return;
        if (needsOnboarding) {
          setPhase('onboarding');
          return;
        }
      } catch {
        // If check fails, skip onboarding.
      }

      if (mounted) setPhase('starting');
    }).catch(() => {
      if (mounted) setPhase('starting');
    });

    return () => { mounted = false; };
  }, []);

  // Listen for gateway status from main process.
  useEffect(() => {
    window.marketbot?.onGatewayStatus((status) => {
      setRunning(status.running);
    });
  }, []);

  // Phase 2: Poll health until gateway is up.
  useEffect(() => {
    if (phase !== 'starting' && phase !== 'connecting') return;
    let mounted = true;

    const poll = async () => {
      if (!gatewayUrl) return;
      try {
        const res = await fetch(`${normalizeBase(gatewayUrl)}/api/health`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ params: {} }),
        });
        if (!mounted) return;
        if (res.ok) {
          const data = (await res.json()) as { ok?: boolean };
          if (data?.ok !== false) {
            setRunning(true);
            setPhase('ready');
            return;
          }
        }
      } catch {
        // Gateway not up yet.
      }
      if (mounted) setPhase('connecting');
    };

    poll();
    const timer = setInterval(poll, 2000);
    return () => { mounted = false; clearInterval(timer); };
  }, [phase, gatewayUrl]);

  // Once ready, keep polling health at a slower rate.
  useEffect(() => {
    if (phase !== 'ready') return;
    let mounted = true;

    const poll = async () => {
      try {
        const res = await fetch(`${normalizeBase(gatewayUrl)}/api/health`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ params: {} }),
        });
        if (!mounted) return;
        const ok = res.ok && ((await res.json()) as { ok?: boolean })?.ok !== false;
        setRunning(ok);
        if (!ok) setPhase('connecting');
      } catch {
        if (mounted) {
          setRunning(false);
          setPhase('connecting');
        }
      }
    };

    const timer = setInterval(poll, 5000);
    return () => { mounted = false; clearInterval(timer); };
  }, [phase, gatewayUrl]);

  const tabUrl = useMemo(() => {
    if (!gatewayUrl || activeTab === 'models') return '';
    return buildTabUrl(gatewayUrl, TABS[activeTab].path, gatewayToken);
  }, [gatewayUrl, gatewayToken, activeTab]);

  // Navigate webview on tab change.
  useEffect(() => {
    const view = webviewRef.current;
    if (!view || !tabUrl) return;
    if (!prevUrlRef.current) {
      prevUrlRef.current = tabUrl;
      return;
    }
    if (tabUrl === prevUrlRef.current) return;
    prevUrlRef.current = tabUrl;
    view.loadURL(tabUrl);
  }, [tabUrl]);

  // Reload webview when gateway comes up after being down.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (phase !== 'ready') return;
    if (running && !wasRunning.current && webviewRef.current && tabUrl) {
      const timer = setTimeout(() => {
        if (webviewRef.current) {
          webviewRef.current.loadURL(tabUrl);
          prevUrlRef.current = tabUrl;
        }
      }, 500);
      wasRunning.current = running;
      return () => clearTimeout(timer);
    }
    wasRunning.current = running;
  }, [running, phase, tabUrl]);

  // Inject token on dom-ready, retry on load failure.
  useEffect(() => {
    const view = webviewRef.current;
    if (!view) return;

    const handleReady = () => {
      injectTokenToWebview(view, gatewayToken);
    };
    const handleFail = () => {
      if (running) {
        setTimeout(() => webviewRef.current?.reload(), 1200);
      }
    };

    view.addEventListener('dom-ready', handleReady);
    view.addEventListener('did-fail-load', handleFail);
    return () => {
      view.removeEventListener('dom-ready', handleReady);
      view.removeEventListener('did-fail-load', handleFail);
    };
  }, [gatewayToken, running]);

  const handleRestart = useCallback(async () => {
    setPhase('connecting');
    await window.marketbot.restartGateway();
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    setPhase('connecting');
  }, []);

  // During onboarding, render only the wizard (no sidebar).
  if (phase === 'onboarding') {
    return <OnboardingWizard onComplete={handleOnboardingComplete} />;
  }

  const showWebview = phase === 'ready' && running && tabUrl;
  const showModelSettings = activeTab === 'models' && phase === 'ready';

  return (
    <div className={`app${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="drag-region" />

        <div className="sidebar-header">
          <div className="brand">
            <div className="logo">MB</div>
            {!sidebarCollapsed && (
              <div>
                <div className="title">MarketBot</div>
                <div className="subtitle">Desktop</div>
              </div>
            )}
          </div>
          <button
            className="collapse-toggle"
            onClick={() => setSidebarCollapsed((v) => !v)}
            title={sidebarCollapsed ? 'Expand' : 'Collapse'}
          >
            {sidebarCollapsed ? '\u25B6' : '\u25C0'}
          </button>
        </div>

        <div className={`status ${running ? 'ok' : 'off'}`}>
          <span className={`status-dot ${running ? 'ok' : 'off'}`} />
          {!sidebarCollapsed && (running ? 'Connected' : phase === 'init' ? 'Initializing' : 'Connecting')}
        </div>

        <nav className="nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="nav-group">
              {!sidebarCollapsed && <div className="nav-group-title">{group.label}</div>}
              {group.tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`nav-item${activeTab === tab.id ? ' active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  title={sidebarCollapsed ? tab.label : undefined}
                >
                  <span className="nav-icon" dangerouslySetInnerHTML={{ __html: tab.icon }} />
                  {!sidebarCollapsed && <span className="nav-label">{tab.label}</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        {!sidebarCollapsed && (
          <button className="ghost sidebar-btn" onClick={handleRestart} title="Restart gateway">
            <span
              className="nav-icon"
              dangerouslySetInnerHTML={{
                __html:
                  '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 10a7 7 0 0113.36-2.83M17 10a7 7 0 01-13.36 2.83"/><path d="M16.5 3v4.5H12M3.5 17v-4.5H8"/></svg>',
              }}
            />
            <span>Restart Gateway</span>
          </button>
        )}
      </aside>

      <main className="content">
        {showModelSettings ? (
          <ModelSettings gatewayUrl={gatewayUrl} gatewayToken={gatewayToken} running={running} />
        ) : showWebview ? (
          <webview
            ref={webviewRef as React.Ref<HTMLElement>}
            src={tabUrl}
            {...(webviewPreload ? { preload: webviewPreload } : {})}
            className="webview-frame"
          />
        ) : (
          <div className="webview-frame loading-state">
            <div className="loading-content">
              <div className="loading-logo">
                <div className="loading-logo-inner">MB</div>
              </div>
              <div className="loading-text">
                {phase === 'init' && 'Initializing...'}
                {phase === 'starting' && 'Starting gateway...'}
                {phase === 'connecting' && 'Connecting to gateway...'}
              </div>
              <div className="loading-progress">
                <div className="loading-progress-bar" />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
