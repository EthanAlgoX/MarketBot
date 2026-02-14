import { useEffect, useMemo, useRef, useState, useCallback } from 'react';

declare global {
  interface Window {
    marketbot: {
      getGatewayToken: () => Promise<string>;
      getGatewayUrl: () => Promise<string>;
      getGatewayStatus: () => Promise<{
        running: boolean;
        stage?: 'idle' | 'checking' | 'starting' | 'running' | 'retrying' | 'error';
        message?: string;
        attempts?: number;
        lastExitCode?: number | null;
      }>;
      getWebviewPreloadPath: () => Promise<string>;
      restartGateway: () => Promise<void>;
      openExternal: (url: string) => Promise<void>;
      onGatewayStatus: (handler: (status: {
        running: boolean;
        stage?: 'idle' | 'checking' | 'starting' | 'running' | 'retrying' | 'error';
        message?: string;
        attempts?: number;
        lastExitCode?: number | null;
      }) => void) => void;
      readConfig: () => Promise<Record<string, unknown>>;
      writeConfig: (patch: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
      checkOnboarding: () => Promise<{ needsOnboarding: boolean }>;
      markOnboardingDone: () => Promise<{ ok: boolean; error?: string }>;
      writeCredentials: (args: { profileId: string; provider: string; apiKey: string }) =>
        Promise<{ ok: boolean; error?: string }>;
      getConfiguredProviders: () => Promise<{ providers: string[] }>;
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
  id: 'chat' | 'workspace' | 'ops' | 'system';
  tabs: NavTab[];
}

type NavBadgeTone = 'default' | 'info' | 'warn' | 'danger';

interface NavBadge {
  text: string;
  tone: NavBadgeTone;
}

interface SidebarMetrics {
  runsTotal: number;
  runsActive: number;
  sessions: number;
  cronTotal: number;
  cronEnabled: number;
  logErrors: number;
}

const EMPTY_SIDEBAR_METRICS: SidebarMetrics = {
  runsTotal: 0,
  runsActive: 0,
  sessions: 0,
  cronTotal: 0,
  cronEnabled: 0,
  logErrors: 0,
};

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
    label: 'Advanced',
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
  { id: 'chat', tabs: [TABS.chat] },
  { id: 'workspace', tabs: [TABS.desk, TABS.stocks, TABS.runs] },
  {
    id: 'ops',
    tabs: [TABS.channels, TABS.sessions, TABS.cron, TABS.logs],
  },
  {
    id: 'system',
    tabs: [TABS.overview, TABS.config, TABS.models],
  },
];

type Language = 'en' | 'zh';

const LANGUAGE_STORAGE_KEY = 'marketbot.desktop.language.v1';

const MESSAGES: Record<Language, Record<string, string>> = {
  en: {
    expand: 'Expand',
    collapse: 'Collapse',
    connected: 'Connected',
    initializing: 'Initializing',
    connecting: 'Connecting',
    gatewayChecking: 'Checking gateway',
    gatewayStarting: 'Starting gateway',
    gatewayRetrying: 'Retrying gateway',
    gatewayError: 'Gateway error',
    restartGateway: 'Restart Gateway',
    languageSwitch: 'Switch Language',
    english: 'EN',
    chinese: '中文',
    desktopSubtitle: 'Desktop',
    loadingInitializing: 'Initializing...',
    loadingStarting: 'Starting gateway...',
    loadingConnecting: 'Connecting to gateway...',
    loadingRetrying: 'Retrying gateway startup...',
    loadingConnectingHint: 'Target: {{url}}',
    loadingConnectingStalled: 'Still connecting. You can click "Restart Gateway".',
    onboardingWelcomeTitle: 'Welcome to MarketBot',
    onboardingWelcomeDesc: "Your autonomous financial analysis agent. Let's get you set up with an AI provider to get started.",
    onboardingGetStarted: 'Get Started',
    onboardingChooseProvider: 'Choose Your AI Provider',
    onboardingChooseProviderDesc: "Select the provider you'd like to use. You can change this later in Settings.",
    back: 'Back',
    onboardingEnterApiKey: 'Enter API Key',
    onboardingEnterApiKeyDesc: 'Paste your {{provider}} API key below.',
    onboardingSaveContinue: 'Save & Continue',
    saving: 'Saving...',
    onboardingDoneTitle: "You're All Set",
    onboardingDoneDesc: 'MarketBot is configured with {{provider}}. The gateway will restart with your new credentials.',
    onboardingStartUsing: 'Start Using MarketBot',
    offlineSettingsHint: 'Gateway is offline. Settings will load once connected.',
    loadingModels: 'Loading models...',
    modelsTitle: 'AI Models',
    refresh: 'Refresh',
    localModels: 'Local Models',
    localModelsDesc: 'Run AI models locally via Ollama. No API key required, completely private.',
    ollamaNotDetected: 'Ollama not detected',
    ollamaNotDetectedDescA: 'Install Ollama from',
    ollamaNotDetectedDescB: 'and make sure it is running.',
    retry: 'Retry',
    localContext: 'Context',
    tokens: 'tokens',
    installed: 'Installed',
    primary: 'Primary',
    setAsPrimary: 'Set as Primary',
    install: 'Install',
    selectModel: 'Select a model',
    primaryModel: 'Primary Model',
    primaryModelDesc: 'The default model used for all conversations and analysis.',
    fallbackModels: 'Fallback Models',
    fallbackModelsDesc: 'Used when the primary model is unavailable. Tried in order.',
    fallbackEmpty: 'No fallback models configured.',
    remove: 'Remove',
    addFallback: 'Add fallback...',
    apiKeys: 'API Keys',
    apiKeysDesc: 'Manage credentials for each AI provider. Keys are stored locally.',
    modelsSummaryTotal: 'Available Models',
    modelsSummaryProviders: 'Model Providers',
    modelsSummaryLocal: 'Local Installed',
    modelsSummaryFallbacks: 'Fallback Count',
    configured: 'Configured',
    notConfigured: 'Not configured',
    cancel: 'Cancel',
    change: 'Change',
    addKey: 'Add Key',
    saveKey: 'Save Key',
    loadModelsFailed: 'Failed to load models',
    saveCredentialsFailed: 'Failed to save credentials',
    saveConfigFailed: 'Failed to save config',
    saveKeyFailed: 'Failed to save key',
    keySaved: 'Key saved',
    keySavedRefreshing: 'Key saved. Refreshing models...',
    pullStart: 'Starting download...',
    pullFailed: 'Failed to pull model',
    primaryModelUpdated: 'Primary model updated',
    primaryModelSet: 'Primary model set to {{model}}',
    errorPrefix: 'Error',
    navChat: 'Chat',
    navDesk: 'Desk',
    navStocks: 'Stocks',
    navRuns: 'Runs',
    navConnection: 'Connection',
    navConfig: 'Advanced',
    navChannels: 'Channels',
    navSessions: 'Sessions',
    navCron: 'Cron Jobs',
    navLogs: 'Logs',
    navModels: 'AI Models',
    groupChat: 'Chat',
    groupWorkspace: 'Workspace',
    groupOps: 'Ops',
    groupSystem: 'System',
  },
  zh: {
    expand: '展开',
    collapse: '收起',
    connected: '已连接',
    initializing: '初始化中',
    connecting: '连接中',
    gatewayChecking: '检查网关中',
    gatewayStarting: '启动网关中',
    gatewayRetrying: '重试网关中',
    gatewayError: '网关异常',
    restartGateway: '重启网关',
    languageSwitch: '切换语言',
    english: 'EN',
    chinese: '中文',
    desktopSubtitle: '桌面端',
    loadingInitializing: '正在初始化...',
    loadingStarting: '正在启动网关...',
    loadingConnecting: '正在连接网关...',
    loadingRetrying: '正在重试网关启动...',
    loadingConnectingHint: '目标地址：{{url}}',
    loadingConnectingStalled: '连接时间较长，可点击“重启网关”。',
    onboardingWelcomeTitle: '欢迎使用 MarketBot',
    onboardingWelcomeDesc: '你的自主金融分析助手。先配置一个 AI 提供商即可开始使用。',
    onboardingGetStarted: '开始配置',
    onboardingChooseProvider: '选择 AI 提供商',
    onboardingChooseProviderDesc: '选择你要使用的提供商，后续可在设置中修改。',
    back: '返回',
    onboardingEnterApiKey: '输入 API Key',
    onboardingEnterApiKeyDesc: '请粘贴 {{provider}} 的 API Key。',
    onboardingSaveContinue: '保存并继续',
    saving: '保存中...',
    onboardingDoneTitle: '配置完成',
    onboardingDoneDesc: 'MarketBot 已配置为 {{provider}}，网关将使用新凭据重启。',
    onboardingStartUsing: '开始使用',
    offlineSettingsHint: '网关离线，连接后将加载设置。',
    loadingModels: '正在加载模型...',
    modelsTitle: 'AI 模型',
    refresh: '刷新',
    localModels: '本地模型',
    localModelsDesc: '通过 Ollama 本地运行模型，无需 API Key，数据更私密。',
    ollamaNotDetected: '未检测到 Ollama',
    ollamaNotDetectedDescA: '请从',
    ollamaNotDetectedDescB: '安装 Ollama，并确保其正在运行。',
    retry: '重试',
    localContext: '上下文',
    tokens: 'tokens',
    installed: '已安装',
    primary: '主模型',
    setAsPrimary: '设为主模型',
    install: '安装',
    selectModel: '选择一个模型',
    primaryModel: '主模型',
    primaryModelDesc: '用于所有对话和分析的默认模型。',
    fallbackModels: '备用模型',
    fallbackModelsDesc: '当主模型不可用时按顺序回退使用。',
    fallbackEmpty: '尚未配置备用模型。',
    remove: '移除',
    addFallback: '添加备用模型...',
    apiKeys: 'API 密钥',
    apiKeysDesc: '管理各个 AI 提供商的凭据，密钥仅保存在本机。',
    modelsSummaryTotal: '可用模型',
    modelsSummaryProviders: '模型提供商',
    modelsSummaryLocal: '本地已安装',
    modelsSummaryFallbacks: '备用模型数',
    configured: '已配置',
    notConfigured: '未配置',
    cancel: '取消',
    change: '修改',
    addKey: '添加密钥',
    saveKey: '保存密钥',
    loadModelsFailed: '加载模型失败',
    saveCredentialsFailed: '保存凭据失败',
    saveConfigFailed: '保存配置失败',
    saveKeyFailed: '保存密钥失败',
    keySaved: '密钥已保存',
    keySavedRefreshing: '密钥已保存，正在刷新模型...',
    pullStart: '开始下载...',
    pullFailed: '模型下载失败',
    primaryModelUpdated: '主模型已更新',
    primaryModelSet: '主模型已设置为 {{model}}',
    errorPrefix: '错误',
    navChat: '聊天',
    navDesk: '总览',
    navStocks: '股票',
    navRuns: '运行',
    navConnection: '连接',
    navConfig: '高级配置',
    navChannels: '通道',
    navSessions: '会话',
    navCron: '定时任务',
    navLogs: '日志',
    navModels: 'AI 模型',
    groupChat: '聊天',
    groupWorkspace: '工作区',
    groupOps: '运维',
    groupSystem: '系统',
  },
};

function getText(language: Language, key: string, vars?: Record<string, string>) {
  const template = MESSAGES[language][key] ?? MESSAGES.en[key] ?? key;
  if (!vars) return template;
  return Object.entries(vars).reduce((acc, [name, value]) => {
    return acc.replaceAll(`{{${name}}}`, value);
  }, template);
}

function getProviderHint(provider: ProviderDef, language: Language) {
  if (language === 'en') return provider.hint;
  const hints: Record<string, string> = {
    anthropic: '在 console.anthropic.com 获取密钥',
    'openai-codex': '在 platform.openai.com 获取密钥',
    google: '在 aistudio.google.com 获取密钥',
    deepseek: '在 platform.deepseek.com 获取密钥',
    openrouter: '在 openrouter.ai 获取密钥',
    groq: '在 console.groq.com 获取密钥',
    mistral: '在 console.mistral.ai 获取密钥',
    xai: '在 console.x.ai 获取密钥',
  };
  return hints[provider.id] ?? provider.hint;
}

function getTabLabel(language: Language, tabId: TabId) {
  const keyById: Record<TabId, string> = {
    chat: 'navChat',
    desk: 'navDesk',
    stocks: 'navStocks',
    runs: 'navRuns',
    overview: 'navConnection',
    config: 'navConfig',
    channels: 'navChannels',
    sessions: 'navSessions',
    cron: 'navCron',
    logs: 'navLogs',
    models: 'navModels',
  };
  return getText(language, keyById[tabId]);
}

function getGroupLabel(language: Language, groupId: NavGroup['id']) {
  const keyById: Record<NavGroup['id'], string> = {
    chat: 'groupChat',
    workspace: 'groupWorkspace',
    ops: 'groupOps',
    system: 'groupSystem',
  };
  return getText(language, keyById[groupId]);
}

// ── Helpers ──

function formatBadgeCount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0';
  const rounded = Math.floor(value);
  return rounded > 99 ? '99+' : String(rounded);
}

function parseLogLevel(line: string) {
  try {
    const obj = JSON.parse(line) as Record<string, unknown>;
    const meta = obj?._meta;
    if (meta && typeof meta === 'object') {
      const logLevelName = (meta as Record<string, unknown>).logLevelName;
      if (typeof logLevelName === 'string') return logLevelName.toLowerCase();
      const level = (meta as Record<string, unknown>).level;
      if (typeof level === 'string') return level.toLowerCase();
    }
    if (typeof obj.level === 'string') return obj.level.toLowerCase();
  } catch {
    return null;
  }
  return null;
}

function normalizeBase(url: string) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function buildTabUrl(
  base: string,
  path: string,
  token: string,
  language: Language,
  extraParams?: Record<string, string | null | undefined>,
) {
  const normalized = normalizeBase(base);
  const url = `${normalized}${path}`;
  const params = new URLSearchParams();
  if (token.trim()) params.set('token', token.trim());
  params.set('embed', '1');
  params.set('lang', language);
  if (extraParams) {
    Object.entries(extraParams).forEach(([key, value]) => {
      const next = typeof value === 'string' ? value.trim() : '';
      if (!next) return;
      params.set(key, next);
    });
  }
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
type GatewayStage = 'idle' | 'checking' | 'starting' | 'running' | 'retrying' | 'error';

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

const CREDENTIAL_GATED_PROVIDER_IDS = new Set<string>([
  ...PROVIDERS.map((provider) => provider.id),
  // Catalog entries typically use "openai" while desktop onboarding uses
  // "openai-codex" profile IDs.
  'openai',
]);

// ── Local Model Definitions ──

interface LocalModelDef {
  id: string;        // ollama model ID (e.g. "qwen3:0.6b")
  name: string;      // display name
  size: string;      // approximate download size
  contextWindow: number;
  description: string;
  descriptionZh: string;
}

const LOCAL_MODELS: LocalModelDef[] = [
  {
    id: 'qwen3:0.6b',
    name: 'Qwen3-0.6B',
    size: '~400MB',
    contextWindow: 32768,
    description: 'Ultra-lightweight, fast responses',
    descriptionZh: '超轻量，响应速度快',
  },
  {
    id: 'qwen3:4b',
    name: 'Qwen3-4B-Instruct',
    size: '~2.5GB',
    contextWindow: 32768,
    description: 'Balanced speed and quality',
    descriptionZh: '速度与效果平衡',
  },
  {
    id: 'qwen3:8b',
    name: 'Qwen3-8B',
    size: '~4.9GB',
    contextWindow: 128000,
    description: 'Strong reasoning capability',
    descriptionZh: '推理能力更强',
  },
  {
    id: 'qwen3:32b',
    name: 'Qwen3-32B',
    size: '~19GB',
    contextWindow: 128000,
    description: 'Best quality, requires more RAM',
    descriptionZh: '质量最佳，但需要更多内存',
  },
];

// ── Onboarding Wizard ──

type OnboardingStep = 'welcome' | 'provider' | 'apikey' | 'done';

function OnboardingWizard({
  onComplete,
  gatewayUrl,
  language,
}: {
  onComplete: () => void;
  gatewayUrl: string;
  language: Language;
}) {
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [selectedProvider, setSelectedProvider] = useState<ProviderDef | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const t = useCallback((key: string, vars?: Record<string, string>) => {
    return getText(language, key, vars);
  }, [language]);

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
        setError(credResult.error || t('saveCredentialsFailed'));
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
        setError(configResult.error || t('saveConfigFailed'));
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
  }, [selectedProvider, apiKey, t]);

  const handleFinish = useCallback(async () => {
    // Bust the gateway's model catalog cache so it re-reads credentials
    // from disk.  This is essential for external (CLI-started) gateways
    // where restartGateway() is a no-op.  For desktop-managed gateways
    // the subsequent restart makes this redundant, but it's harmless.
    const base = normalizeBase(gatewayUrl);
    try {
      await fetch(`${base}/api/models.list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params: { refresh: true } }),
      });
    } catch {
      // Gateway may not be reachable yet; the restart below will handle it.
    }
    // Restart gateway so desktop-managed gateways pick up new config.
    await window.marketbot.restartGateway();
    onComplete();
  }, [gatewayUrl, onComplete]);

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
            <h1 className="onboarding-title">{t('onboardingWelcomeTitle')}</h1>
            <p className="onboarding-desc">
              {t('onboardingWelcomeDesc')}
            </p>
            <button className="primary onboarding-btn" onClick={() => setStep('provider')}>
              {t('onboardingGetStarted')}
            </button>
          </div>
        )}

        {step === 'provider' && (
          <div className="onboarding-step fade-in">
            <h2 className="onboarding-step-title">{t('onboardingChooseProvider')}</h2>
            <p className="onboarding-desc">
              {t('onboardingChooseProviderDesc')}
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
              {t('back')}
            </button>
          </div>
        )}

        {step === 'apikey' && selectedProvider && (
          <div className="onboarding-step fade-in">
            <h2 className="onboarding-step-title">{t('onboardingEnterApiKey')}</h2>
            <p className="onboarding-desc">
              {t('onboardingEnterApiKeyDesc', { provider: selectedProvider.label })}
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
              <p className="apikey-hint">{getProviderHint(selectedProvider, language)}</p>
            </div>
            {error && <div className="onboarding-error">{error}</div>}
            <div className="onboarding-actions">
              <button className="ghost" onClick={handleBack}>{t('back')}</button>
              <button
                className="primary"
                onClick={handleSaveKey}
                disabled={!apiKey.trim() || saving}
              >
                {saving ? t('saving') : t('onboardingSaveContinue')}
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
            <h2 className="onboarding-step-title">{t('onboardingDoneTitle')}</h2>
            <p className="onboarding-desc">
              {t('onboardingDoneDesc', { provider: selectedProvider?.label ?? '' })}
            </p>
            <button className="primary onboarding-btn" onClick={handleFinish}>
              {t('onboardingStartUsing')}
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
  language,
}: {
  gatewayUrl: string;
  gatewayToken: string;
  running: boolean;
  language: Language;
}) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [primaryModel, setPrimaryModel] = useState('');
  const [fallbacks, setFallbacks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [saveMsgError, setSaveMsgError] = useState(false);

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
  const t = useCallback((key: string, vars?: Record<string, string>) => {
    return getText(language, key, vars);
  }, [language]);

  const rpc = useCallback(
    async (method: string, params: Record<string, unknown> = {}) => {
      const res = await fetch(`${base}/api/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params }),
      });
      if (!res.ok) throw new Error(`RPC ${method} failed: ${res.status}`);
      // The HTTP RPC endpoint wraps responses in { ok, result, error }.
      // Unwrap the envelope so callers receive the payload directly.
      const envelope = await res.json();
      if (!envelope.ok) throw new Error(envelope.error?.message ?? `RPC ${method} failed`);
      return envelope.result;
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
      // Fetch models, config, and configured-provider status independently
      // so one failing doesn't block the others from updating state.
      const [modelsResult, configResult, credResult] = await Promise.allSettled([
        rpc('models.list'),
        rpc('config.get'),
        window.marketbot.getConfiguredProviders(),
      ]);

      if (modelsResult.status === 'fulfilled') {
        const modelList: ModelInfo[] = modelsResult.value?.models ?? [];
        setModels(modelList);
      }

      if (configResult.status === 'fulfilled') {
        // Extract current primary model from config
        const snapshot = configResult.value as Record<string, unknown> | undefined;
        const cfg = snapshot?.config as Record<string, unknown> | undefined;
        const agentModel = cfg?.agents as
          | Record<string, unknown>
          | undefined;
        const defaults = agentModel?.defaults as Record<string, unknown> | undefined;
        const model = defaults?.model as Record<string, unknown> | undefined;
        const primary = (model?.primary as string) ?? '';
        const fb = (model?.fallbacks as string[]) ?? [];
        setPrimaryModel(primary);
        setFallbacks(fb);
      }
      // Determine configured providers from auth-profiles/env plus
      // models.providers.*.apiKey in config (AI models UI).
      if (credResult.status === 'fulfilled' || configResult.status === 'fulfilled') {
        const nextConfigured = new Set<string>();
        if (credResult.status === 'fulfilled') {
          const ids: string[] = credResult.value?.providers ?? [];
          for (const id of ids) nextConfigured.add(id);
        }
        if (configResult.status === 'fulfilled') {
          const snapshot = configResult.value as Record<string, unknown> | undefined;
          const cfg = snapshot?.config as Record<string, unknown> | undefined;
          const modelsCfg = cfg?.models as Record<string, unknown> | undefined;
          const providers = modelsCfg?.providers as Record<string, unknown> | undefined;
          if (providers && typeof providers === 'object') {
            for (const [id, raw] of Object.entries(providers)) {
              if (!raw || typeof raw !== 'object') continue;
              const apiKey = (raw as { apiKey?: unknown }).apiKey;
              if (typeof apiKey === 'string' && apiKey.trim()) {
                nextConfigured.add(id);
              }
            }
          }
        }
        setConfiguredProviders(nextConfigured);
      }

      // Show error only if both failed during initial load.
      if (showSpinner && modelsResult.status === 'rejected' && configResult.status === 'rejected') {
        setError(t('loadModelsFailed'));
      }
    } catch {
      // Silently ignore refresh errors (gateway may be restarting).
      if (showSpinner) setError(t('loadModelsFailed'));
    } finally {
      setLoading(false);
    }
  }, [running, rpc, t]);

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
    setPullStatus(t('pullStart'));
    setPullError('');
    const result = await window.marketbot.pullOllamaModel(modelId);
    if (!result.ok) {
      setPullError(result.error || t('pullFailed'));
      setPullingModel(null);
    }
  }, [t]);

  // Set a local model as primary.
  const handleSetLocalPrimary = useCallback(async (modelId: string) => {
    setSaving(true);
    setSaveMsg('');
    try {
      // Write to config file via IPC (for persistence).
      const result = await window.marketbot.setOllamaModel(modelId);
      if (!result.ok) {
        setSaveMsg(`${t('errorPrefix')}: ${result.error}`);
        setSaveMsgError(true);
        return;
      }
      setPrimaryModel(`ollama/${modelId}`);
      setSaveMsg(t('primaryModelSet', { model: `ollama/${modelId}` }));
      setSaveMsgError(false);
      // Tell the gateway to reload config via RPC.
      try {
        await rpc('config.patch', {
          raw: JSON.stringify({ agents: { defaults: { model: { primary: `ollama/${modelId}` } } } }),
        });
      } catch {
        // Fallback if RPC unavailable.
        await window.marketbot.restartGateway();
      }
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setSaveMsg(`${t('errorPrefix')}: ${String(err)}`);
      setSaveMsgError(true);
    } finally {
      setSaving(false);
    }
  }, [rpc, t]);

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

  const isInstalledOllamaModel = useCallback(
    (modelId: string) => {
      if (!modelId.startsWith('ollama/')) return false;
      const modelName = modelId.slice('ollama/'.length);
      return installedModels.some(
        (installedId) =>
          installedId === modelName ||
          installedId === `${modelName}:latest` ||
          installedId.startsWith(`${modelName}:`),
      );
    },
    [installedModels],
  );

  const primarySelectableGroupedModels = useMemo(() => {
    const groups: Record<string, ModelInfo[]> = {};
    for (const [provider, providerModels] of Object.entries(groupedModels)) {
      const availableModels = providerModels.filter((model) => {
        if (model.provider === 'ollama') {
          return isInstalledOllamaModel(model.id);
        }
        if (!CREDENTIAL_GATED_PROVIDER_IDS.has(model.provider)) {
          return true;
        }
        if (configuredProviders.has(model.provider)) {
          return true;
        }
        // Support OpenAI provider alias between model catalog and credential profile.
        if (model.provider === 'openai') {
          return configuredProviders.has('openai-codex');
        }
        if (model.provider === 'openai-codex') {
          return configuredProviders.has('openai');
        }
        return false;
      });
      if (availableModels.length > 0) {
        groups[provider] = availableModels;
      }
    }
    return groups;
  }, [configuredProviders, groupedModels, isInstalledOllamaModel]);

  const localInstalledCount = useMemo(() => {
    return LOCAL_MODELS.filter((lm) =>
      installedModels.some(
        (modelId) =>
          modelId === lm.id ||
          modelId === `${lm.id}:latest` ||
          modelId.startsWith(`${lm.id}:`),
      ),
    ).length;
  }, [installedModels]);

  // Change primary model via config.patch
  const handlePrimaryChange = useCallback(
    async (newModel: string) => {
      if (!newModel || newModel === primaryModel) return;
      setSaving(true);
      setSaveMsg('');
      try {
        await rpc('config.patch', {
          raw: JSON.stringify({
            agents: { defaults: { model: { primary: newModel } } },
          }),
        });
        setPrimaryModel(newModel);
        setSaveMsg(t('primaryModelUpdated'));
        setSaveMsgError(false);
        setTimeout(() => setSaveMsg(''), 3000);
      } catch (err) {
        setSaveMsg(`${t('errorPrefix')}: ${String(err)}`);
        setSaveMsgError(true);
      } finally {
        setSaving(false);
      }
    },
    [primaryModel, rpc, t],
  );

  // Remove a fallback
  const removeFallback = useCallback(
    async (idx: number) => {
      const next = fallbacks.filter((_, i) => i !== idx);
      setSaving(true);
      try {
        await rpc('config.patch', {
          raw: JSON.stringify({
            agents: { defaults: { model: { fallbacks: next } } },
          }),
        });
        setFallbacks(next);
      } catch (err) {
        setSaveMsg(`${t('errorPrefix')}: ${String(err)}`);
        setSaveMsgError(true);
      } finally {
        setSaving(false);
      }
    },
    [fallbacks, rpc, t],
  );

  // Add a fallback
  const addFallback = useCallback(
    async (modelId: string) => {
      if (!modelId || fallbacks.includes(modelId)) return;
      const next = [...fallbacks, modelId];
      setSaving(true);
      try {
        await rpc('config.patch', {
          raw: JSON.stringify({
            agents: { defaults: { model: { fallbacks: next } } },
          }),
        });
        setFallbacks(next);
      } catch (err) {
        setSaveMsg(`${t('errorPrefix')}: ${String(err)}`);
        setSaveMsgError(true);
      } finally {
        setSaving(false);
      }
    },
    [fallbacks, rpc, t],
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
          setKeyError(result.error || t('saveKeyFailed'));
          return;
        }

        // If no primary model is configured yet, set this provider's
        // default model as primary so the user doesn't have to do it
        // manually (mirrors the onboarding wizard behaviour).
        if (!primaryModel) {
          await window.marketbot.writeConfig({
            agents: {
              defaults: {
                model: { primary: provider.defaultModel },
              },
            },
          });
        }

        setKeySuccess(t('keySavedRefreshing'));
        setEditKey('');
        // Bust the gateway's model catalog cache via RPC so it re-reads
        // auth-profiles from disk. This works for both desktop-managed and
        // external (CLI-started) gateways without needing a restart.
        // A short delay ensures the credential file write is fully flushed.
        await new Promise((r) => setTimeout(r, 500));
        try {
          await rpc('models.list', { refresh: true });
        } catch {
          // If the first attempt fails (gateway may be busy), retry once.
          await new Promise((r) => setTimeout(r, 2000));
          try {
            await rpc('models.list', { refresh: true });
          } catch {
            // ignore; fetchData below will retry
          }
        }
        // Re-fetch all data (models + config) to update the UI.
        await fetchData();
        setKeySuccess(t('keySaved'));
        setTimeout(() => {
          setEditingProvider(null);
          setKeySuccess('');
        }, 1500);
      } catch (err) {
        setKeyError(String(err));
      } finally {
        setKeySaving(false);
      }
    },
    [editKey, primaryModel, fetchData, rpc, t],
  );

  if (!running) {
    return (
      <div className="ms-panel">
        <div className="ms-header">
          <h1 className="ms-title">{t('modelsTitle')}</h1>
        </div>
        <div className="ms-offline">
          <p>{t('offlineSettingsHint')}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="ms-panel">
        <div className="ms-header">
          <h1 className="ms-title">{t('modelsTitle')}</h1>
        </div>
        <div className="ms-loading">
          <div className="loading-progress" style={{ width: 120 }}>
            <div className="loading-progress-bar" />
          </div>
          <span>{t('loadingModels')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="ms-panel">
      <div className="ms-header">
        <h1 className="ms-title">{t('modelsTitle')}</h1>
        <button className="ghost ms-refresh" onClick={() => fetchData(true)} title={t('refresh')}>
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

      <section className="ms-summary-grid" aria-label={t('modelsTitle')}>
        <div className="ms-summary-card">
          <div className="ms-summary-label">{t('modelsSummaryTotal')}</div>
          <div className="ms-summary-value">{models.length}</div>
        </div>
        <div className="ms-summary-card">
          <div className="ms-summary-label">{t('modelsSummaryProviders')}</div>
          <div className="ms-summary-value">{Object.keys(groupedModels).length}</div>
        </div>
        <div className="ms-summary-card">
          <div className="ms-summary-label">{t('modelsSummaryLocal')}</div>
          <div className="ms-summary-value">{localInstalledCount}</div>
        </div>
        <div className="ms-summary-card">
          <div className="ms-summary-label">{t('modelsSummaryFallbacks')}</div>
          <div className="ms-summary-value">{fallbacks.length}</div>
        </div>
      </section>

      {/* ── Local Models ── */}
      <section className="ms-section ms-section-card">
        <h2 className="ms-section-title">{t('localModels')}</h2>
        <p className="ms-section-desc">
          {t('localModelsDesc')}
        </p>

        {!ollamaAvailable && (
          <div className="ms-local-warning">
            <span className="ms-local-warning-icon">!</span>
            <div>
              <strong>{t('ollamaNotDetected')}</strong>
              <p>
                {t('ollamaNotDetectedDescA')}{' '}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    window.marketbot.openExternal('https://ollama.com');
                  }}
                >
                  ollama.com
                </a>{' '}
                {t('ollamaNotDetectedDescB')}
              </p>
              <button className="ghost ms-local-retry" onClick={checkOllamaStatus}>
                {t('retry')}
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
                <div className="ms-local-card-desc">{language === 'zh' ? lm.descriptionZh : lm.description}</div>
                <div className="ms-local-card-meta">
                  {t('localContext')}: {Math.round(lm.contextWindow / 1000)}k {t('tokens')}
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
                    <span className="ms-local-installed-badge">{t('installed')}</span>
                    {isPrimary ? (
                      <span className="ms-local-primary-badge">{t('primary')}</span>
                    ) : (
                      <button
                        className="ms-local-set-primary"
                        onClick={() => handleSetLocalPrimary(lm.id)}
                        disabled={saving}
                      >
                        {t('setAsPrimary')}
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    className="ms-local-install-btn"
                    onClick={() => handlePullModel(lm.id)}
                    disabled={!ollamaAvailable || pullingModel !== null}
                  >
                    {t('install')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Primary Model ── */}
      <section className="ms-section ms-section-card">
        <h2 className="ms-section-title">{t('primaryModel')}</h2>
        <p className="ms-section-desc">
          {t('primaryModelDesc')}
        </p>
        <div className="ms-model-select-wrap">
          <select
            className="ms-model-select"
            value={primaryModel}
            onChange={(e) => handlePrimaryChange(e.target.value)}
            disabled={saving}
          >
            {!primaryModel && <option value="">{t('selectModel')}</option>}
            {Object.entries(primarySelectableGroupedModels).map(([provider, providerModels]) => (
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
          <div className={`ms-save-msg${saveMsgError ? ' error' : ''}`}>
            {saveMsg}
          </div>
        )}
      </section>

      {/* ── Fallback Models ── */}
      <section className="ms-section ms-section-card">
        <h2 className="ms-section-title">{t('fallbackModels')}</h2>
        <p className="ms-section-desc">
          {t('fallbackModelsDesc')}
        </p>
        <div className="ms-fallback-list">
          {fallbacks.length === 0 && (
            <div className="ms-fallback-empty">{t('fallbackEmpty')}</div>
          )}
          {fallbacks.map((fb, idx) => (
            <div key={fb} className="ms-fallback-item">
              <span className="ms-fallback-rank">{idx + 1}</span>
              <span className="ms-fallback-name">{fb}</span>
              <button
                className="ms-fallback-remove"
                onClick={() => removeFallback(idx)}
                title={t('remove')}
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
                {t('addFallback')}
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
      <section className="ms-section ms-section-card">
        <h2 className="ms-section-title">{t('apiKeys')}</h2>
        <p className="ms-section-desc">
          {t('apiKeysDesc')}
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
                      {isConfigured ? t('configured') : t('notConfigured')}
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
                    {isEditing ? t('cancel') : isConfigured ? t('change') : t('addKey')}
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
                    <p className="apikey-hint">{getProviderHint(p, language)}</p>
                    {keyError && <div className="ms-key-error">{keyError}</div>}
                    {keySuccess && <div className="ms-key-success">{keySuccess}</div>}
                    <button
                      className="primary ms-key-save"
                      onClick={() => handleSaveKey(p)}
                      disabled={!editKey.trim() || keySaving}
                    >
                      {keySaving ? t('saving') : t('saveKey')}
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
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved === 'en' || saved === 'zh') return saved;
      return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
    } catch {
      return 'en';
    }
  });
  const [phase, setPhase] = useState<BootPhase>('init');
  const [running, setRunning] = useState(false);
  const [gatewayStage, setGatewayStage] = useState<GatewayStage>('idle');
  const [gatewayMessage, setGatewayMessage] = useState('');
  const [gatewayAttempts, setGatewayAttempts] = useState(0);
  const [connectingSince, setConnectingSince] = useState<number | null>(null);
  const [connectingElapsedMs, setConnectingElapsedMs] = useState(0);
  const [gatewayUrl, setGatewayUrl] = useState('');
  const [gatewayToken, setGatewayToken] = useState('');
  const [webviewPreload, setWebviewPreload] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentModel, setCurrentModel] = useState('');
  const [statusExpanded, setStatusExpanded] = useState(false);
  const [sidebarMetrics, setSidebarMetrics] = useState<SidebarMetrics>(EMPTY_SIDEBAR_METRICS);
  const webviewRef = useRef<(HTMLElement & {
    loadURL: (url: string) => void;
    reload: () => void;
    executeJavaScript: (code: string, userGesture?: boolean) => Promise<unknown>;
    isLoading?: () => boolean;
  }) | null>(null);
  const prevUrlRef = useRef('');
  const activeTabRef = useRef<TabId>('chat');
  const pendingTabRef = useRef<TabId | null>(null);
  const t = useCallback((key: string, vars?: Record<string, string>) => {
    return getText(language, key, vars);
  }, [language]);

  useEffect(() => {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // ignore storage errors
    }
  }, [language]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const handleRequestTabChange = useCallback((next: TabId) => {
    const view = webviewRef.current;
    if (view && typeof view.isLoading === 'function' && view.isLoading()) {
      pendingTabRef.current = next;
      return;
    }
    pendingTabRef.current = null;
    setActiveTab(next);
  }, []);

  // Phase 1: Fetch config from main process, then check onboarding.
  useEffect(() => {
    let mounted = true;
    setPhase('init');

    Promise.all([
      window.marketbot?.getGatewayToken(),
      window.marketbot?.getGatewayUrl(),
      window.marketbot?.getGatewayStatus?.(),
      window.marketbot?.getWebviewPreloadPath(),
    ]).then(async ([token, url, status, preload]) => {
      if (!mounted) return;
      setGatewayToken(token || '');
      setGatewayUrl(url || 'http://127.0.0.1:18789/');
      if (status) {
        setRunning(Boolean(status.running));
        setGatewayStage(status.stage ?? 'idle');
        setGatewayMessage(status.message ?? '');
        setGatewayAttempts(typeof status.attempts === 'number' ? status.attempts : 0);
      }
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
      setGatewayStage(status.stage ?? (status.running ? 'running' : 'idle'));
      setGatewayMessage(status.message ?? '');
      setGatewayAttempts(typeof status.attempts === 'number' ? status.attempts : 0);
    });
  }, []);

  useEffect(() => {
    const waiting = !running && (phase === 'starting' || phase === 'connecting');
    if (waiting) {
      setConnectingSince((prev) => prev ?? Date.now());
      return;
    }
    setConnectingSince(null);
    setConnectingElapsedMs(0);
  }, [phase, running]);

  useEffect(() => {
    if (!connectingSince) return;
    const refresh = () => setConnectingElapsedMs(Date.now() - connectingSince);
    refresh();
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }, [connectingSince]);

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

  // Fetch current primary model for the sidebar status.
  useEffect(() => {
    if (phase !== 'ready') return;
    let mounted = true;

    const fetchModel = async () => {
      if (!gatewayUrl || !running) {
        if (mounted) setCurrentModel('');
        return;
      }
      try {
        const res = await fetch(`${normalizeBase(gatewayUrl)}/api/config.get`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ params: {} }),
        });
        if (!res.ok) return;
        const envelope = await res.json();
        if (!envelope?.ok) return;
        const cfg = envelope.result?.config as Record<string, unknown> | undefined;
        const agents = cfg?.agents as Record<string, unknown> | undefined;
        const defaults = agents?.defaults as Record<string, unknown> | undefined;
        const model = defaults?.model as Record<string, unknown> | undefined;
        const primary = model?.primary;
        if (mounted) {
          setCurrentModel(typeof primary === 'string' ? primary : '');
        }
      } catch {
        // ignore
      }
    };

    fetchModel();
    const timer = setInterval(fetchModel, 10000);
    return () => { mounted = false; clearInterval(timer); };
  }, [phase, gatewayUrl, running]);

  // Fetch compact sidebar metrics for ops tabs.
  useEffect(() => {
    if (phase !== 'ready' || !running || !gatewayUrl) {
      setSidebarMetrics(EMPTY_SIDEBAR_METRICS);
      return;
    }
    let mounted = true;
    const base = normalizeBase(gatewayUrl);

    const rpc = async (method: string, params: Record<string, unknown>) => {
      const res = await fetch(`${base}/api/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params }),
      });
      if (!res.ok) throw new Error(`RPC ${method} failed: ${res.status}`);
      const envelope = await res.json();
      if (!envelope?.ok) throw new Error(envelope?.error?.message ?? `RPC ${method} failed`);
      return envelope.result;
    };

    const fetchSidebarMetrics = async () => {
      const [runsResult, sessionsResult, cronResult, logsResult] = await Promise.allSettled([
        rpc('trace.runs.list', { limit: 80 }),
        rpc('sessions.list', { includeGlobal: true, includeUnknown: false, limit: 120 }),
        rpc('cron.list', { includeDisabled: true }),
        rpc('logs.tail', { limit: 120, maxBytes: 262144 }),
      ]);
      if (!mounted) return;

      setSidebarMetrics((prev) => {
        const next = { ...prev };

        if (runsResult.status === 'fulfilled') {
          const payload = runsResult.value as { runs?: unknown };
          const runs = Array.isArray(payload.runs)
            ? payload.runs.filter((item) => item && typeof item === 'object')
            : [];
          next.runsTotal = runs.length;
          next.runsActive = runs.filter((item) => {
            const run = item as { status?: unknown };
            return run.status === 'running';
          }).length;
        }

        if (sessionsResult.status === 'fulfilled') {
          const payload = sessionsResult.value as { count?: unknown; sessions?: unknown };
          const count = typeof payload.count === 'number'
            ? payload.count
            : Array.isArray(payload.sessions)
              ? payload.sessions.length
              : 0;
          next.sessions = Math.max(0, Math.floor(count));
        }

        if (cronResult.status === 'fulfilled') {
          const payload = cronResult.value as { jobs?: unknown };
          const jobs = Array.isArray(payload.jobs)
            ? payload.jobs.filter((item) => item && typeof item === 'object')
            : [];
          next.cronTotal = jobs.length;
          next.cronEnabled = jobs.filter((item) => {
            const job = item as { enabled?: unknown };
            return Boolean(job.enabled);
          }).length;
        }

        if (logsResult.status === 'fulfilled') {
          const payload = logsResult.value as { lines?: unknown };
          const lines = Array.isArray(payload.lines)
            ? payload.lines.filter((line) => typeof line === 'string') as string[]
            : [];
          next.logErrors = lines.reduce((count, line) => {
            const level = parseLogLevel(line);
            if (level === 'error' || level === 'fatal') return count + 1;
            return count;
          }, 0);
        }

        return next;
      });
    };

    fetchSidebarMetrics().catch(() => undefined);
    const timer = setInterval(() => {
      fetchSidebarMetrics().catch(() => undefined);
    }, 15000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [phase, running, gatewayUrl]);

  const navBadges = useMemo<Partial<Record<TabId, NavBadge>>>(() => {
    const badges: Partial<Record<TabId, NavBadge>> = {};
    if (sidebarMetrics.runsActive > 0) {
      badges.runs = { text: formatBadgeCount(sidebarMetrics.runsActive), tone: 'info' };
    } else if (sidebarMetrics.runsTotal > 0) {
      badges.runs = { text: formatBadgeCount(sidebarMetrics.runsTotal), tone: 'default' };
    }

    if (sidebarMetrics.sessions > 0) {
      badges.sessions = { text: formatBadgeCount(sidebarMetrics.sessions), tone: 'default' };
    }

    if (sidebarMetrics.cronTotal > 0) {
      badges.cron = {
        text: formatBadgeCount(sidebarMetrics.cronEnabled),
        tone: sidebarMetrics.cronEnabled > 0 ? 'info' : 'warn',
      };
    }

    if (sidebarMetrics.logErrors > 0) {
      badges.logs = { text: formatBadgeCount(sidebarMetrics.logErrors), tone: 'danger' };
    }

    return badges;
  }, [sidebarMetrics]);

  const tabUrl = useMemo(() => {
    if (!gatewayUrl || activeTab === 'models') return '';
    const extraParams =
      activeTab === 'config'
        ? { section: 'gateway' }
        : undefined;
    return buildTabUrl(gatewayUrl, TABS[activeTab].path, gatewayToken, language, extraParams);
  }, [gatewayUrl, gatewayToken, activeTab, language]);

  // Keep the last non-empty URL so we can preserve webview state while the
  // models panel is shown (tabUrl becomes empty for models).
  useEffect(() => {
    if (!tabUrl) return;
    prevUrlRef.current = tabUrl;
  }, [tabUrl]);

  const lastWebviewUrl = tabUrl || prevUrlRef.current;

  // Inject token on dom-ready, retry on load failure.
  useEffect(() => {
    const view = webviewRef.current;
    if (!view) return;

    const handleReady = () => {
      injectTokenToWebview(view, gatewayToken);
    };
    const handleStopLoading = () => {
      const next = pendingTabRef.current;
      if (!next || next === activeTabRef.current) return;
      pendingTabRef.current = null;
      setActiveTab(next);
    };
    const handleFail = (event: Event) => {
      const details = event as Event & { errorCode?: number; isMainFrame?: boolean };
      // Electron reports superseded navigations as ERR_ABORTED (-3); these are
      // expected during quick tab/session transitions and should not trigger reloads.
      if (details.errorCode === -3) return;
      if (details.isMainFrame === false) return;
      if (running) {
        setTimeout(() => webviewRef.current?.reload(), 1200);
      }
    };

    view.addEventListener('dom-ready', handleReady);
    view.addEventListener('did-stop-loading', handleStopLoading);
    view.addEventListener('did-fail-load', handleFail);
    return () => {
      view.removeEventListener('dom-ready', handleReady);
      view.removeEventListener('did-stop-loading', handleStopLoading);
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

  const handleToggleLanguage = useCallback(() => {
    setLanguage((prev) => (prev === 'zh' ? 'en' : 'zh'));
  }, []);
  const languageToggleLabel = language === 'zh' ? t('english') : t('chinese');

  const connectionLabel = useMemo(() => {
    if (running) return t('connected');
    if (phase === 'init') return t('initializing');
    if (gatewayStage === 'checking') return t('gatewayChecking');
    if (gatewayStage === 'starting') return t('gatewayStarting');
    if (gatewayStage === 'retrying') return t('gatewayRetrying');
    if (gatewayStage === 'error') return t('gatewayError');
    return t('connecting');
  }, [gatewayStage, phase, running, t]);

  const loadingText = useMemo(() => {
    if (phase === 'init') return t('loadingInitializing');
    if (phase === 'starting') return t('loadingStarting');
    if (phase === 'connecting' && gatewayStage === 'retrying') return t('loadingRetrying');
    return t('loadingConnecting');
  }, [gatewayStage, phase, t]);

  const connectionDetail = useMemo(() => {
    if (running && currentModel) return currentModel;
    if (gatewayMessage.trim()) {
      return gatewayAttempts > 0 ? `${gatewayMessage.trim()} (#${gatewayAttempts})` : gatewayMessage.trim();
    }
    if ((phase === 'starting' || phase === 'connecting') && gatewayUrl) {
      return t('loadingConnectingHint', { url: normalizeBase(gatewayUrl) });
    }
    return '';
  }, [currentModel, gatewayAttempts, gatewayMessage, gatewayUrl, phase, running, t]);
  const canExpandStatus = Boolean(connectionDetail) && !running && !sidebarCollapsed;
  const statusDetailClass = running
    ? 'status-model'
    : `status-model status-detail${statusExpanded ? ' status-detail-expanded' : ''}`;

  const showConnectingStalledHint = !running
    && (phase === 'starting' || phase === 'connecting')
    && connectingElapsedMs >= 15_000;

  // During onboarding, render only the wizard (no sidebar).
  if (phase === 'onboarding') {
    return (
      <OnboardingWizard
        onComplete={handleOnboardingComplete}
        gatewayUrl={gatewayUrl}
        language={language}
      />
    );
  }

  const showWebviewContainer = phase === 'ready' && running && Boolean(lastWebviewUrl);
  const showWebview = showWebviewContainer && activeTab !== 'models';
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
                <div className="subtitle">{t('desktopSubtitle')}</div>
              </div>
            )}
          </div>
          <div className="sidebar-header-actions">
            <button
              className="collapse-toggle"
              onClick={() => setSidebarCollapsed((v) => !v)}
              title={sidebarCollapsed ? t('expand') : t('collapse')}
            >
              {sidebarCollapsed ? '\u25B6' : '\u25C0'}
            </button>
          </div>
        </div>

        <div
          className={`status ${running ? 'ok' : 'off'}${canExpandStatus ? ' status-expandable' : ''}`}
          onClick={canExpandStatus ? () => setStatusExpanded((prev) => !prev) : undefined}
          onKeyDown={
            canExpandStatus
              ? (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setStatusExpanded((prev) => !prev);
                  }
                }
              : undefined
          }
          role={canExpandStatus ? 'button' : undefined}
          tabIndex={canExpandStatus ? 0 : undefined}
          title={canExpandStatus ? (statusExpanded ? t('collapse') : t('expand')) : undefined}
        >
          <span className={`status-dot ${running ? 'ok' : 'off'}`} />
          {!sidebarCollapsed && (
            <div className="status-text">
              <div>{connectionLabel}</div>
              {connectionDetail ? (
                <div className={statusDetailClass}>{connectionDetail}</div>
              ) : null}
            </div>
          )}
        </div>

        <nav className="nav">
          {NAV_GROUPS.map((group) => (
            <div key={group.id} className="nav-group">
              {!sidebarCollapsed && <div className="nav-group-title">{getGroupLabel(language, group.id)}</div>}
              {group.tabs.map((tab) => {
                const badge = navBadges[tab.id];
                const tabTitle = sidebarCollapsed
                  ? `${getTabLabel(language, tab.id)}${badge ? ` (${badge.text})` : ''}`
                  : undefined;
                return (
                  <button
                    key={tab.id}
                    className={`nav-item${activeTab === tab.id ? ' active' : ''}`}
                    onClick={() => handleRequestTabChange(tab.id)}
                    title={tabTitle}
                  >
                    <span className="nav-icon" dangerouslySetInnerHTML={{ __html: tab.icon }} />
                    {!sidebarCollapsed && (
                      <>
                        <span className="nav-label">{getTabLabel(language, tab.id)}</span>
                        {badge ? <span className={`nav-badge ${badge.tone}`}>{badge.text}</span> : null}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-tools">
          <button
            className="ghost sidebar-btn sidebar-lang-toggle"
            onClick={handleToggleLanguage}
            title={t('languageSwitch')}
          >
            <span
              className="nav-icon"
              dangerouslySetInnerHTML={{
                __html:
                  '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="7.5"/><path d="M2.5 10h15M10 2.5c2 2 3 4.9 3 7.5s-1 5.5-3 7.5M10 2.5c-2 2-3 4.9-3 7.5s1 5.5 3 7.5"/></svg>',
              }}
            />
            {!sidebarCollapsed && <span className="sidebar-tool-label">{t('languageSwitch')}</span>}
            <span className="sidebar-lang-badge">{languageToggleLabel}</span>
          </button>

          <button className="ghost sidebar-btn restart-btn" onClick={handleRestart} title={t('restartGateway')}>
            <span
              className="nav-icon"
              dangerouslySetInnerHTML={{
                __html:
                  '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 10a7 7 0 0113.36-2.83M17 10a7 7 0 01-13.36 2.83"/><path d="M16.5 3v4.5H12M3.5 17v-4.5H8"/></svg>',
              }}
            />
            {!sidebarCollapsed && <span>{t('restartGateway')}</span>}
          </button>
        </div>
      </aside>

      <main className="content">
        {showWebviewContainer ? (
          <webview
            ref={webviewRef as React.Ref<HTMLElement>}
            src={lastWebviewUrl}
            {...(webviewPreload ? { preload: webviewPreload } : {})}
            className={`webview-frame${showWebview ? '' : ' hidden'}`}
          />
        ) : null}

        {showModelSettings ? (
          <ModelSettings
            gatewayUrl={gatewayUrl}
            gatewayToken={gatewayToken}
            running={running}
            language={language}
          />
        ) : !showWebviewContainer ? (
          <div className="webview-frame loading-state">
            <div className="loading-content">
              <div className="loading-logo">
                <div className="loading-logo-inner">MB</div>
              </div>
              <div className="loading-text">{loadingText}</div>
              {connectionDetail ? (
                <div className="loading-subtext">{connectionDetail}</div>
              ) : null}
              {showConnectingStalledHint ? (
                <div className="loading-actions">
                  <div className="loading-stalled-hint">{t('loadingConnectingStalled')}</div>
                  <button className="ghost loading-restart-btn" onClick={handleRestart}>
                    {t('restartGateway')}
                  </button>
                </div>
              ) : null}
              <div className="loading-progress">
                <div className="loading-progress-bar" />
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
