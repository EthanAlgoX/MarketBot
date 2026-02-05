import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Play,
    Terminal,
    CheckCircle2,
    XCircle,
    Loader2,
    Cpu,
    Activity,
    ChevronRight,
    Eye,
    Compass,
    Zap,
    Clock,
    Search,
    Settings,
    Layout,
    Maximize2,
    MessageSquare,
    Image as ImageIcon
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface Action {
    id: string;
    action: string;
    input: Record<string, any>;
    thought?: string;
    observation?: string;
    screenshots?: string[];
    point?: { x: number; y: number };
    actionType?: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
    output?: any;
    error?: string;
}

interface Intent {
    id: string;
    intent: string;
    steps: Action[];
    timestamp?: number;
}

type ProviderModelDraft = {
    id: string;
    name: string;
    reasoning?: boolean;
    input?: Array<'text' | 'image'>;
    cost?: {
        input?: number;
        output?: number;
        cacheRead?: number;
        cacheWrite?: number;
    };
    contextWindow?: number;
    maxTokens?: number;
    headers?: Record<string, string>;
    compat?: Record<string, unknown>;
};

type ProviderEntry = {
    baseUrl?: string;
    apiKey?: string;
    auth?: string;
    api?: string;
    models?: ProviderModelDraft[];
};

export default function App() {
    const [intents, setIntents] = useState<Intent[]>([]);
    const [selectedIntentId, setSelectedIntentId] = useState<string | null>(null);
    const [inputText, setInputText] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentStepIdx, setCurrentStepIdx] = useState<number>(-1);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [settingsError, setSettingsError] = useState<string | null>(null);
    const [settingsData, setSettingsData] = useState<{
        agentId?: string;
        agentName?: string;
        agentAvatar?: string;
        configPath?: string;
        defaultModel?: string;
        gatewayMode?: string;
        providers?: string[];
    } | null>(null);
    const [settingsConfig, setSettingsConfig] = useState<Record<string, unknown> | null>(null);
    const [settingsHash, setSettingsHash] = useState<string | null>(null);
    const [modelProvider, setModelProvider] = useState('');
    const [modelId, setModelId] = useState('');
    const [authProvider, setAuthProvider] = useState('');
    const [authApiKey, setAuthApiKey] = useState('');
    const [providerBaseUrl, setProviderBaseUrl] = useState('');
    const [providerApi, setProviderApi] = useState('');
    const [providerAuthMode, setProviderAuthMode] = useState('');
    const [providerModels, setProviderModels] = useState<ProviderModelDraft[]>([]);
    const [newModelId, setNewModelId] = useState('');
    const [newModelName, setNewModelName] = useState('');
    const [newModelReasoning, setNewModelReasoning] = useState(false);
    const [newModelInputText, setNewModelInputText] = useState(true);
    const [newModelInputImage, setNewModelInputImage] = useState(false);
    const [newModelContextWindow, setNewModelContextWindow] = useState('');
    const [newModelMaxTokens, setNewModelMaxTokens] = useState('');
    const [settingsSaveState, setSettingsSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const [settingsSaveError, setSettingsSaveError] = useState<string | null>(null);
    const [settingsSaveNote, setSettingsSaveNote] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const wsReconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const gatewayToken = useMemo(() => {
        if (typeof window === 'undefined') return '';
        return new URLSearchParams(window.location.search).get('token')?.trim() ?? '';
    }, []);

    type ExecutorUpdate = {
        intentId: string;
        actionId: string;
        status: Action['status'];
        thought?: string;
        observation?: string;
        screenshots?: string[];
        point?: { x: number; y: number };
        actionType?: string;
        output?: unknown;
        error?: string;
    };

    const KNOWN_PROVIDERS = [
        'openai',
        'openai-codex',
        'anthropic',
        'google',
        'deepseek',
        'groq',
        'mistral',
        'cerebras',
        'xai',
        'moonshot',
        'openrouter',
        'vercel-ai-gateway',
        'kimi-coding',
        'zai',
        'xiaomi',
        'synthetic',
        'venice',
        'minimax',
        'minimax-portal',
        'qwen-portal',
        'opencode',
        'ollama'
    ];

    const resolveProviders = (config: Record<string, unknown> | null): string[] => {
        const models = config?.models;
        if (!models || typeof models !== 'object') return [];
        const providers = (models as { providers?: unknown }).providers;
        if (!providers || typeof providers !== 'object') return [];
        return Object.keys(providers as Record<string, unknown>);
    };

    const resolveProviderEntry = (config: Record<string, unknown> | null, provider: string): ProviderEntry | null => {
        const models = config?.models;
        if (!models || typeof models !== 'object') return null;
        const providers = (models as { providers?: unknown }).providers;
        if (!providers || typeof providers !== 'object') return null;
        return (providers as Record<string, ProviderEntry>)[provider] ?? null;
    };

    const resolveModelsForProvider = (config: Record<string, unknown> | null, provider: string): string[] => {
        if (!provider) return [];
        const entry = resolveProviderEntry(config, provider) as { models?: unknown } | null;
        const list = Array.isArray(entry?.models) ? entry?.models : [];
        return list
            .map((model) => (model && typeof model === 'object' ? (model as { id?: string }).id : undefined))
            .filter((id): id is string => Boolean(id));
    };

    const resolveProviderOptions = (config: Record<string, unknown> | null): string[] => {
        const fromConfig = resolveProviders(config);
        const combined = new Set<string>([...fromConfig, ...KNOWN_PROVIDERS]);
        return Array.from(combined).sort((a, b) => a.localeCompare(b));
    };

    const splitModelRef = (ref: string | undefined, fallbackProvider: string | undefined) => {
        if (!ref) {
            return { provider: fallbackProvider ?? '', model: '' };
        }
        const trimmed = ref.trim();
        if (!trimmed) {
            return { provider: fallbackProvider ?? '', model: '' };
        }
        const parts = trimmed.split('/');
        if (parts.length >= 2) {
            return { provider: parts[0], model: parts.slice(1).join('/') };
        }
        return { provider: fallbackProvider ?? '', model: trimmed };
    };

    const hydrateProviderState = (config: Record<string, unknown> | null, provider: string) => {
        const entry = resolveProviderEntry(config, provider);
        setProviderBaseUrl(entry?.baseUrl ?? '');
        setProviderApi(entry?.api ?? '');
        setProviderAuthMode(entry?.auth ?? '');
        setProviderModels(Array.isArray(entry?.models) ? entry?.models : []);
    };

    // Filtered intents for sidebar search
    const filteredIntents = intents.filter(i =>
        i.intent.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const selectedIntent = intents.find(i => i.id === selectedIntentId) || intents[0];

    useEffect(() => {
        // Initial selection
        if (intents.length > 0 && !selectedIntentId) {
            setSelectedIntentId(intents[0].id);
        }
    }, [intents]);

    useEffect(() => {
        // Reset current step index when selected intent changes
        if (selectedIntent) {
            setCurrentStepIdx(selectedIntent.steps.length - 1);
        } else {
            setCurrentStepIdx(-1);
        }
    }, [selectedIntentId, intents]);

    const loadSettings = async () => {
        setSettingsLoading(true);
        setSettingsError(null);
        try {
            const [identityRes, configRes] = await Promise.all([
                fetch('/api/agent.identity.get', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ params: {} })
                }).then(r => r.json()),
                fetch('/api/config.get', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ params: {} })
                }).then(r => r.json())
            ]);

            const next: {
                agentId?: string;
                agentName?: string;
                agentAvatar?: string;
                configPath?: string;
                defaultModel?: string;
                gatewayMode?: string;
                providers?: string[];
            } = {};
            const errors: string[] = [];

            if (identityRes?.ok && identityRes.result) {
                next.agentId = identityRes.result.agentId;
                next.agentName = identityRes.result.name;
                next.agentAvatar = identityRes.result.avatar;
            } else {
                errors.push('Failed to load agent identity');
            }

            if (configRes?.ok && configRes.result) {
                const cfg = configRes.result.config ?? {};
                const defaultsModel = typeof cfg.agents?.defaults?.model === 'string'
                    ? cfg.agents.defaults.model
                    : cfg.agents?.defaults?.model?.primary;
                const agents = Array.isArray(cfg.agents?.list) ? cfg.agents.list : [];
                const defaultAgent = agents.find((agent: any) => agent?.default) ?? agents[0];
                const agentModel = typeof defaultAgent?.model === 'string'
                    ? defaultAgent.model
                    : defaultAgent?.model?.primary;
                next.defaultModel = agentModel || defaultsModel || 'unset';
                next.gatewayMode = cfg.gateway?.mode ?? 'unknown';
                next.providers = Object.keys(cfg.models?.providers ?? {});
                next.configPath = configRes.result.path;
                setSettingsConfig(cfg);
                setSettingsHash(configRes.result.hash ?? null);

                const providers = resolveProviders(cfg);
                const { provider, model } = splitModelRef(next.defaultModel, providers[0]);
                const nextProvider = provider || providers[0] || '';
                const models = resolveModelsForProvider(cfg, nextProvider);
                const nextModel = model && models.includes(model) ? model : (models[0] ?? '');
                setModelProvider(nextProvider);
                setModelId(nextModel);
                const nextAuthProvider = nextProvider || providers[0] || '';
                setAuthProvider(nextAuthProvider);
                hydrateProviderState(cfg, nextAuthProvider);
            } else {
                errors.push('Failed to load config');
            }

            setSettingsData(next);
            setSettingsError(errors.length > 0 ? errors.join('. ') : null);
        } catch (err) {
            setSettingsError(String(err));
        } finally {
            setSettingsLoading(false);
        }
    };

    useEffect(() => {
        if (!isSettingsOpen) {
            return;
        }
        loadSettings();
    }, [isSettingsOpen]);

    useEffect(() => {
        if (!settingsConfig || !modelProvider) return;
        const models = resolveModelsForProvider(settingsConfig, modelProvider);
        if (models.length > 0 && !models.includes(modelId)) {
            setModelId(models[0]);
        }
    }, [settingsConfig, modelProvider, modelId]);

    useEffect(() => {
        if (!settingsConfig || !authProvider) return;
        hydrateProviderState(settingsConfig, authProvider);
        setAuthApiKey('');
    }, [settingsConfig, authProvider]);

    useEffect(() => {
        if (!isSettingsOpen) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsSettingsOpen(false);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isSettingsOpen]);

    const handleSaveSettings = async () => {
        setSettingsSaveState('saving');
        setSettingsSaveError(null);
        setSettingsSaveNote(null);
        const patch: Record<string, unknown> = {};
        if (modelProvider && modelId) {
            patch.agents = {
                defaults: {
                    model: { primary: `${modelProvider}/${modelId}` }
                }
            };
        }
        const existingProvider = authProvider ? resolveProviderEntry(settingsConfig, authProvider) : null;
        const existingModels = Array.isArray(existingProvider?.models) ? existingProvider?.models : [];
        const modelsChanged =
            JSON.stringify(providerModels ?? []) !== JSON.stringify(existingModels ?? []);
        const baseUrlChanged = providerBaseUrl.trim() && providerBaseUrl.trim() !== (existingProvider?.baseUrl ?? '');
        const apiChanged = providerApi !== (existingProvider?.api ?? '');
        const authChanged = providerAuthMode !== (existingProvider?.auth ?? '');
        const apiKeyChanged = authApiKey.trim().length > 0;

        if (authProvider && (modelsChanged || baseUrlChanged || apiChanged || authChanged || apiKeyChanged)) {
            const providerPatch: ProviderEntry = {};
            const resolvedBaseUrl = providerBaseUrl.trim() || existingProvider?.baseUrl;
            if (resolvedBaseUrl) {
                providerPatch.baseUrl = resolvedBaseUrl;
            }
            if (providerApi.trim()) {
                providerPatch.api = providerApi.trim();
            } else if (existingProvider?.api && !providerApi.trim()) {
                providerPatch.api = existingProvider.api;
            }
            if (providerAuthMode.trim()) {
                providerPatch.auth = providerAuthMode.trim();
            } else if (existingProvider?.auth && !providerAuthMode.trim()) {
                providerPatch.auth = existingProvider.auth;
            }
            providerPatch.models = providerModels ?? [];
            if (apiKeyChanged) {
                providerPatch.apiKey = authApiKey.trim();
            }
            if (!providerPatch.baseUrl) {
                setSettingsSaveState('error');
                setSettingsSaveError('Provider base URL is required.');
                return;
            }
            patch.models = {
                providers: {
                    [authProvider]: providerPatch
                }
            };
        }
        if (Object.keys(patch).length === 0) {
            setSettingsSaveState('error');
            setSettingsSaveError('No changes to apply.');
            return;
        }
        if (!settingsHash) {
            setSettingsSaveState('error');
            setSettingsSaveError('Missing config base hash. Reopen settings and try again.');
            return;
        }
        try {
            const resp = await fetch('/api/config.patch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    params: {
                        baseHash: settingsHash,
                        raw: JSON.stringify(patch),
                        note: 'Updated from dashboard settings'
                    }
                })
            });
            const data = await resp.json();
            if (!data?.ok) {
                const message = data?.error?.message ?? 'Failed to update config';
                setSettingsSaveState('error');
                setSettingsSaveError(message);
                return;
            }
            if (data?.result?.restart?.scheduled) {
                setSettingsSaveNote('Gateway restart scheduled.');
            } else if (data?.result?.restart?.skipped) {
                setSettingsSaveNote('Gateway restart skipped.');
            }
            setSettingsSaveState('saved');
            setAuthApiKey('');
            await loadSettings();
        } catch (err) {
            setSettingsSaveState('error');
            setSettingsSaveError(String(err));
        } finally {
            setTimeout(() => setSettingsSaveState('idle'), 2000);
        }
    };

    const addModelToProvider = () => {
        const id = newModelId.trim();
        const name = newModelName.trim();
        if (!id || !name) {
            setSettingsSaveState('error');
            setSettingsSaveError('Model id and name are required.');
            return;
        }
        if (providerModels.some((model) => model.id === id)) {
            setSettingsSaveState('error');
            setSettingsSaveError(`Model id "${id}" already exists.`);
            return;
        }
        const input: Array<'text' | 'image'> = [];
        if (newModelInputText) input.push('text');
        if (newModelInputImage) input.push('image');
        const contextWindow = newModelContextWindow.trim() ? Number(newModelContextWindow) : undefined;
        const maxTokens = newModelMaxTokens.trim() ? Number(newModelMaxTokens) : undefined;
        const next: ProviderModelDraft = {
            id,
            name,
            reasoning: newModelReasoning,
            input: input.length > 0 ? input : undefined,
            contextWindow: Number.isFinite(contextWindow) ? contextWindow : undefined,
            maxTokens: Number.isFinite(maxTokens) ? maxTokens : undefined
        };
        setProviderModels((prev) => [...prev, next]);
        setNewModelId('');
        setNewModelName('');
        setNewModelReasoning(false);
        setNewModelInputText(true);
        setNewModelInputImage(false);
        setNewModelContextWindow('');
        setNewModelMaxTokens('');
        setSettingsSaveState('idle');
        setSettingsSaveError(null);
    };

    const removeModelFromProvider = (id: string) => {
        setProviderModels((prev) => prev.filter((model) => model.id !== id));
    };

    const applyExecutorUpdate = (update: ExecutorUpdate) => {
        setIntents((prev) => {
            const idx = prev.findIndex((intent) => intent.id === update.intentId);
            if (idx === -1) return prev;
            const target = prev[idx];
            const steps = target.steps.map((step) => {
                if (step.id !== update.actionId) return step;
                const next = { ...step, status: update.status };
                if (update.thought !== undefined) next.thought = update.thought;
                if (update.observation !== undefined) next.observation = update.observation;
                if (update.screenshots !== undefined) next.screenshots = update.screenshots;
                if (update.point !== undefined) next.point = update.point;
                if (update.actionType !== undefined) next.actionType = update.actionType;
                if (update.output !== undefined) next.output = update.output;
                if (update.error !== undefined) next.error = update.error;
                return next;
            });
            const nextIntent = { ...target, steps };
            const next = [...prev];
            next[idx] = nextIntent;
            return next;
        });
    };

    const buildGatewayWsUrl = () => {
        if (typeof window === 'undefined') return null;
        const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const port = window.location.port;
        const host = window.location.hostname;
        const resolvedPort = port === '3002' ? '19001' : port;
        return resolvedPort ? `${proto}://${host}:${resolvedPort}` : `${proto}://${host}`;
    };

    useEffect(() => {
        let disposed = false;
        const connect = () => {
            if (disposed) return;
            if (wsRef.current) {
                wsRef.current.close();
            }
            const wsUrl = buildGatewayWsUrl();
            if (!wsUrl) return;
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;
            let connectSent = false;
            const connectId = `connect-${Date.now()}`;
            const sendConnect = () => {
                if (connectSent || ws.readyState !== WebSocket.OPEN) return;
                connectSent = true;
                const params = {
                    minProtocol: 3,
                    maxProtocol: 3,
                    client: {
                        id: 'gateway-client',
                        version: 'dev',
                        platform: navigator.platform || 'web',
                        mode: 'ui'
                    },
                    role: 'operator',
                    scopes: ['operator.admin'],
                    auth: gatewayToken ? { token: gatewayToken } : undefined
                };
                ws.send(JSON.stringify({ type: 'req', id: connectId, method: 'connect', params }));
            };
            const handleMessage = (raw: string) => {
                try {
                    const parsed = JSON.parse(raw);
                    if (parsed?.type === 'event') {
                        if (parsed.event === 'connect.challenge' && !connectSent) {
                            sendConnect();
                            return;
                        }
                        if (parsed.event === 'executor.update' && parsed.payload) {
                            applyExecutorUpdate(parsed.payload as ExecutorUpdate);
                        }
                        return;
                    }
                    if (parsed?.type === 'res' && parsed.id === connectId && !parsed.ok) {
                        console.error(parsed.error?.message ?? 'Gateway connect failed.');
                    }
                } catch (err) {
                    console.error(err);
                }
            };
            ws.addEventListener('open', sendConnect);
            ws.addEventListener('message', (event) => {
                if (typeof event.data === 'string') {
                    handleMessage(event.data);
                } else if (event.data instanceof Blob) {
                    event.data.text().then(handleMessage).catch(console.error);
                } else if (event.data instanceof ArrayBuffer) {
                    handleMessage(new TextDecoder().decode(event.data));
                }
            });
            ws.addEventListener('close', () => {
                if (disposed) return;
                if (wsRef.current === ws) {
                    wsRef.current = null;
                }
                if (wsReconnectRef.current) {
                    clearTimeout(wsReconnectRef.current);
                }
                wsReconnectRef.current = setTimeout(connect, 1000);
            });
            ws.addEventListener('error', (err) => {
                console.error(err);
            });
        };
        connect();
        return () => {
            disposed = true;
            if (wsReconnectRef.current) {
                clearTimeout(wsReconnectRef.current);
                wsReconnectRef.current = null;
            }
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [gatewayToken]);

    const formatStepOutput = (output: unknown): { mode: 'text' | 'json'; value: string } | null => {
        if (output === null || output === undefined) return null;
        if (typeof output === 'string') {
            return { mode: 'text', value: output };
        }
        if (typeof output === 'object') {
            const outputObj = output as Record<string, unknown>;
            const report = outputObj.report;
            if (typeof report === 'string') {
                return { mode: 'text', value: report };
            }
            const content = outputObj.content;
            if (Array.isArray(content)) {
                const textChunks = content
                    .map((entry) => (entry && typeof entry === 'object' ? (entry as { text?: unknown }).text : null))
                    .filter((text): text is string => typeof text === 'string' && text.trim().length > 0);
                if (textChunks.length > 0) {
                    return { mode: 'text', value: textChunks.join('\n') };
                }
            }
        }
        return { mode: 'json', value: JSON.stringify(output, null, 2) };
    };

    const createPendingIntent = (text: string): Intent => {
        const now = Date.now();
        return {
            id: `pending-${now}`,
            intent: text,
            timestamp: now,
            steps: [
                {
                    id: `pending-step-${now}`,
                    action: 'PARSE',
                    input: { text },
                    thought: 'Preparing task plan...',
                    status: 'RUNNING'
                }
            ]
        };
    };

    const handleRun = async () => {
        const trimmed = inputText.trim();
        if (!trimmed || isParsing) return;
        const pending = createPendingIntent(trimmed);
        setIntents([pending]);
        setSelectedIntentId(pending.id);
        setIsParsing(true);
        try {
            const resp = await fetch('/api/executor.parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ params: { text: trimmed } })
            });
            const data = await resp.json();
            if (data.ok) {
                const intent = { ...data.result, timestamp: Date.now() };
                setIntents([intent]);
                setSelectedIntentId(intent.id);

                await fetch('/api/executor.run', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ params: intent })
                });
            } else {
                setIntents([
                    {
                        ...pending,
                        steps: pending.steps.map((step) => ({
                            ...step,
                            status: 'FAILED',
                            error: data?.error?.message ?? 'Failed to parse task.'
                        }))
                    }
                ]);
            }
        } catch (err) {
            console.error(err);
            setIntents([
                {
                    ...pending,
                    steps: pending.steps.map((step) => ({
                        ...step,
                        status: 'FAILED',
                        error: String(err)
                    }))
                }
            ]);
        } finally {
            setIsParsing(false);
            setInputText('');
        }
    };

    const handleNewTask = () => {
        setIntents([]);
        setSelectedIntentId(null);
        setInputText('');
    };

    const visualSteps = selectedIntent
        ? selectedIntent.steps.filter(s => s.screenshots && s.screenshots.length > 0)
        : [];

    const currentVisual = currentStepIdx >= 0 && selectedIntent?.steps[currentStepIdx]?.screenshots?.length
        ? {
            url: selectedIntent.steps[currentStepIdx].screenshots![0],
            stepIdx: currentStepIdx,
            point: selectedIntent.steps[currentStepIdx].point,
            actionType: selectedIntent.steps[currentStepIdx].actionType || selectedIntent.steps[currentStepIdx].action
        }
        : null;

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans selection:bg-primary/30">
            {/* Sidebar: Task Sessions */}
            <aside className="w-80 border-r border-border flex flex-col glass z-20">
                <div className="p-6 border-b border-border space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
                                <Cpu className="text-white w-5 h-5" />
                            </div>
                            <h1 className="text-sm font-bold tracking-widest uppercase">MarketBot <span className="text-primary">Core</span></h1>
                        </div>
                        <button
                            onClick={handleNewTask}
                            className="p-2 rounded-lg hover:bg-white/5 transition-colors group"
                            title="New Task"
                        >
                            <Layout className="w-4 h-4 text-slate-500 group-hover:text-primary transition-colors" />
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search tasks..."
                            className="w-full bg-white/[0.02] border border-white/5 rounded-xl py-2 pl-10 pr-4 text-xs focus:outline-none focus:border-primary/50 transition-colors placeholder:text-slate-600"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-1 scroll-hide">
                    {filteredIntents.map(intent => (
                        <div
                            key={intent.id}
                            onClick={() => setSelectedIntentId(intent.id)}
                            className={cn(
                                "sidebar-item",
                                selectedIntentId === intent.id && "active"
                            )}
                        >
                            <div className="flex-1 min-w-0">
                                <p className="truncate text-white font-semibold">{intent.intent}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Clock className="w-3 h-3 text-slate-500" />
                                    <span className="text-[10px] text-slate-500 font-medium">
                                        {intent.timestamp ? new Date(intent.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                                    </span>
                                </div>
                            </div>
                            <ChevronRight className={cn("w-4 h-4 text-slate-600 transition-all", selectedIntentId === intent.id && "translate-x-1 text-primary")} />
                        </div>
                    ))}
                    {filteredIntents.length === 0 && (
                        <div className="py-24 text-center text-slate-600 space-y-4">
                            <Compass className="w-10 h-10 mx-auto opacity-10 animate-spin-slow" />
                            <p className="text-xs font-medium tracking-wide">No active missions</p>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-border flex items-center justify-between glass">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse" />
                        <span className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-40">System Healthy</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsSettingsOpen(true)}
                        className="p-1 rounded-md hover:bg-white/5 transition-colors"
                        aria-label="Open settings"
                    >
                        <Settings className="w-4 h-4 text-slate-600 hover:text-white transition-colors" />
                    </button>
                </div>
            </aside>

            {/* Main Workspace */}
            <main className="flex-1 flex overflow-hidden relative bg-slate-950/20">
                {/* Left Panel: Action Trace */}
                <section className="flex-1 flex flex-col border-r border-border relative">
                    <header className="h-16 px-8 border-b border-border flex items-center justify-between glass z-10">
                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                                <MessageSquare className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold tracking-tight text-white/90">
                                    {selectedIntent ? selectedIntent.intent : 'Intel Stream'}
                                </h2>
                                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest mt-0.5">
                                    Autonomous reasoning active
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex -space-x-2">
                                <div className="w-6 h-6 rounded-full border-2 border-background bg-slate-800 flex items-center justify-center">
                                    <Activity className="w-3 h-3 text-primary" />
                                </div>
                            </div>
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto p-12 space-y-12 scroll-hide" ref={scrollRef}>
                        {!selectedIntent ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-6">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                                    <Activity className="relative w-16 h-16 opacity-20 animate-pulse text-primary" />
                                </div>
                                <div className="text-center space-y-2">
                                    <p className="text-sm font-semibold tracking-widest uppercase text-slate-500">Awaiting Signal</p>
                                    <p className="text-xs text-slate-600">Transmit a command to begin observation.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="max-w-2xl mx-auto w-full space-y-1 hover:space-y-4 transition-all duration-500">
                                {selectedIntent.steps.map((step, idx) => {
                                    const formattedOutput = formatStepOutput(step.output);
                                    return (
                                        <div
                                            key={step.id}
                                            className={cn(
                                                "trace-card group animate-in",
                                                currentStepIdx === idx && "opacity-100",
                                                currentStepIdx !== idx && "opacity-40 hover:opacity-100"
                                            )}
                                            onClick={() => setCurrentStepIdx(idx)}
                                        >
                                            <div className={cn(
                                                "trace-dot transition-all duration-300",
                                                step.status === 'COMPLETED' ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-500" :
                                                    step.status === 'RUNNING' ? "bg-primary border-primary/50 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]" :
                                                        step.status === 'FAILED' ? "bg-destructive/10 border-destructive/50 text-destructive" :
                                                            "bg-slate-900 border-white/5 text-slate-600"
                                            )}>
                                                {step.status === 'COMPLETED' ? <CheckCircle2 className="w-3 h-3" /> :
                                                    step.status === 'RUNNING' ? <Loader2 className="w-3 h-3 animate-spin" /> :
                                                        step.status === 'FAILED' ? <XCircle className="w-3 h-3" /> :
                                                            <span className="text-[8px] font-bold">{idx + 1}</span>}
                                            </div>

                                            <div className="space-y-6">
                                                {step.thought && (
                                                    <div className="flex gap-4 items-start pl-2">
                                                        <div className="mt-1.5 p-1 rounded-md bg-primary/5 border border-primary/10">
                                                            <Compass className="w-3 h-3 text-primary/60" />
                                                        </div>
                                                        <p className="text-sm text-slate-300 leading-relaxed font-medium">
                                                            {step.thought}
                                                        </p>
                                                    </div>
                                                )}

                                                <div className={cn(
                                                    "glass-card p-5 space-y-4 group-hover:border-primary/30 transition-all duration-500 relative overflow-hidden",
                                                    currentStepIdx === idx && "border-primary/40 bg-white/[0.04] shadow-[0_0_30px_rgba(99,102,241,0.05)]"
                                                )}>
                                                    {currentStepIdx === idx && <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 blur-3xl -mr-12 -mt-12" />}

                                                    <div className="flex items-center justify-between relative z-10">
                                                        <div className="flex items-center gap-3">
                                                            <span className="action-badge">{step.action}</span>
                                                            <span className="text-[10px] font-mono text-slate-600 tracking-tighter">TASK_{step.id.slice(0, 8)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {step.screenshots && step.screenshots.length > 0 && (
                                                                <ImageIcon className="w-3 h-3 text-primary animate-pulse" />
                                                            )}
                                                            <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Phase {idx + 1}</span>
                                                        </div>
                                                    </div>
                                                    <pre className="text-[11px] font-mono text-slate-500 overflow-x-auto p-4 bg-black/40 rounded-xl border border-white/[0.03] scroll-hide">
                                                        {JSON.stringify(step.input, null, 2)}
                                                    </pre>

                                                    {formattedOutput && (
                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
                                                                <Terminal className="w-3 h-3 text-primary/70" />
                                                                Output
                                                            </div>
                                                            <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto p-4 bg-black/60 rounded-xl border border-white/[0.04] scroll-hide max-h-96 whitespace-pre-wrap">
                                                                {formattedOutput.value}
                                                            </pre>
                                                        </div>
                                                    )}

                                                    {step.error && (
                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-destructive">
                                                                <XCircle className="w-3 h-3" />
                                                                Error
                                                            </div>
                                                            <pre className="text-[11px] font-mono text-destructive/80 overflow-x-auto p-4 bg-destructive/10 rounded-xl border border-destructive/20 scroll-hide whitespace-pre-wrap">
                                                                {step.error}
                                                            </pre>
                                                        </div>
                                                    )}
                                                </div>

                                                {step.observation && (
                                                    <div className="flex gap-4 items-start pl-6 py-4 bg-emerald-500/[0.02] rounded-2xl border border-emerald-500/10 group-hover:border-emerald-500/20 transition-all duration-500">
                                                        <div className="mt-1 p-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                                        </div>
                                                        <p className="text-sm text-emerald-400/70 font-medium leading-relaxed">
                                                            {step.observation}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <div className="h-32" /> {/* Bottom Spacing */}
                    </div>

                    {/* Floating Command Bar */}
                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-30">
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-primary via-accent to-primary rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000 animate-tilt"></div>
                            <div className="relative flex glass rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/10 ring-1 ring-white/5 bg-slate-900/40">
                                <div className="pl-6 flex items-center">
                                    <Zap className={cn("w-4 h-4 text-primary", isParsing && "animate-pulse")} />
                                </div>
                                <input
                                    className="flex-1 bg-transparent px-4 py-5 outline-none text-sm placeholder:text-slate-600 font-medium"
                                    placeholder="Direct MarketBot intelligence..."
                                    value={inputText}
                                    onChange={e => setInputText(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleRun()}
                                />
                                <div className="pr-2 flex items-center">
                                    <button
                                        onClick={handleRun}
                                        disabled={isParsing || !inputText.trim()}
                                        className="bg-primary hover:bg-primary/80 disabled:opacity-30 transition-all duration-300 px-6 py-3 rounded-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-primary/20"
                                    >
                                        {isParsing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-current" />}
                                        Run
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Right Panel: Visual Workspace (UI-TARS Style) */}
                <section className="w-[45%] flex flex-col glass overflow-hidden border-l border-border bg-black/40">
                    <header className="h-16 px-8 border-b border-border flex items-center justify-between glass z-10">
                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                <Eye className="w-4 h-4 text-emerald-400" />
                            </div>
                            <div>
                                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white/80">Optical Feedback</h2>
                                {currentVisual && (
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-[9px] text-emerald-500 font-bold uppercase">Real-time Optic Sync</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center bg-white/5 rounded-full p-1 border border-white/5">
                                <button className="p-1.5 rounded-full hover:bg-white/5 text-slate-500 transition-colors">
                                    <Maximize2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </header>

                    <div className="flex-1 overflow-hidden flex flex-col relative">
                        {/* Step Browser / Navigator */}
                        {visualSteps.length > 1 && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 bg-background/80 backdrop-blur-xl border border-white/10 rounded-full z-40 shadow-2xl scale-90 hover:scale-100 transition-transform">
                                <button
                                    onClick={() => {
                                        const prev = [...visualSteps].reverse().find(s => selectedIntent?.steps.indexOf(s) < (currentStepIdx === -1 ? selectedIntent.steps.length : currentStepIdx));
                                        if (prev) setCurrentStepIdx(selectedIntent!.steps.indexOf(prev));
                                    }}
                                    className="p-1 hover:text-primary transition-colors disabled:opacity-20"
                                    disabled={currentStepIdx <= selectedIntent!.steps.indexOf(visualSteps[0])}
                                >
                                    <ChevronRight className="w-4 h-4 rotate-180" />
                                </button>
                                <div className="h-3 w-px bg-white/10 mx-1" />
                                <span className="text-[9px] font-black uppercase tracking-widest px-2">
                                    Capture {visualSteps.findIndex(s => selectedIntent?.steps.indexOf(s) === currentStepIdx) + 1} / {visualSteps.length}
                                </span>
                                <div className="h-3 w-px bg-white/10 mx-1" />
                                <button
                                    onClick={() => {
                                        const next = visualSteps.find(s => selectedIntent?.steps.indexOf(s) > currentStepIdx);
                                        if (next) setCurrentStepIdx(selectedIntent!.steps.indexOf(next));
                                    }}
                                    className="p-1 hover:text-primary transition-colors disabled:opacity-20"
                                    disabled={currentStepIdx >= selectedIntent!.steps.indexOf(visualSteps[visualSteps.length - 1])}
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {currentVisual ? (
                            <div className="flex-1 relative flex items-center justify-center p-12 group bg-[#020205]">
                                <div className="relative w-full h-full flex items-center justify-center">
                                    {/* Glass Frame */}
                                    <div className="absolute inset-0 border border-white/10 rounded-2xl pointer-events-none z-10" />

                                    <img
                                        src={currentVisual.url.startsWith('http') || currentVisual.url.startsWith('data:') ? currentVisual.url : `/media/${currentVisual.url}`}
                                        className="max-w-full max-h-full object-contain rounded-xl shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/5"
                                        alt="Current optic frame"
                                    />

                                    {/* Interaction Point / Coordinate Tracer */}
                                    {currentVisual.point && (
                                        <div
                                            className="absolute z-30"
                                            style={{
                                                left: `${(currentVisual.point.x / 1000) * 100}%`,
                                                top: `${(currentVisual.point.y / 1000) * 100}%`,
                                                transform: 'translate(-50%, -50%)'
                                            }}
                                        >
                                            <div className="relative group/marker">
                                                {/* Pulsing Aura */}
                                                <div className="absolute inset-0 w-24 h-24 -m-12 bg-primary/20 rounded-full animate-ping-slow" />
                                                <div className="absolute inset-0 w-16 h-16 -m-8 bg-primary/30 rounded-full animate-pulse" />

                                                {/* The Core Dot */}
                                                <div className="w-8 h-8 rounded-full bg-slate-950 border-2 border-primary shadow-[0_0_20px_rgba(99,102,241,0.8)] flex items-center justify-center scale-100 group-hover/marker:scale-125 transition-transform duration-500">
                                                    <div className="w-2 h-2 bg-primary rounded-full shadow-[0_0_5px_rgba(99,102,241,1)]" />
                                                </div>

                                                {/* Identity Shield / Tooltip */}
                                                <div className="absolute top-12 left-1/2 -translate-x-1/2 px-4 py-2 bg-slate-900/90 backdrop-blur-xl rounded-xl border border-primary/30 text-[9px] text-white/90 whitespace-nowrap shadow-2xl pointer-events-none transition-all duration-500 scale-75 opacity-0 group-hover/marker:scale-100 group-hover/marker:opacity-100 border-b-2 border-b-primary">
                                                    <div className="flex flex-col gap-1 items-center">
                                                        <span className="font-black uppercase tracking-[0.2em]">{currentVisual.actionType}</span>
                                                        <div className="h-px i-full bg-white/10" />
                                                        <span className="font-mono text-primary">COORD: {currentVisual.point.x}, {currentVisual.point.y}</span>
                                                    </div>
                                                </div>

                                                {/* Optical Detailing / Magnifier */}
                                                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-64 h-64 rounded-3xl border-2 border-primary/50 bg-[#05050a] shadow-[0_0_60px_rgba(99,102,241,0.4)] overflow-hidden pointer-events-none opacity-0 group-hover/marker:opacity-100 transition-all duration-700 scale-50 group-hover/marker:scale-100 origin-bottom border-dashed ring-8 ring-black/50">
                                                    <div className="absolute inset-0 bg-primary/5 z-10 pointer-events-none opacity-20" />
                                                    <img
                                                        src={currentVisual.url.startsWith('http') || currentVisual.url.startsWith('data:') ? currentVisual.url : `/media/${currentVisual.url}`}
                                                        className="absolute max-w-none grayscale-[0.2]"
                                                        style={{
                                                            width: '1000%', // 10x Optical Zoom
                                                            left: `${-(currentVisual.point.x / 1000) * 1000 + 50}%`,
                                                            top: `${-(currentVisual.point.y / 1000) * 1000 + 50}%`,
                                                            imageRendering: 'crisp-edges'
                                                        }}
                                                        alt="X-Ray optic detail"
                                                    />
                                                    {/* Reticle Control */}
                                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                                                        <div className="w-full h-[1px] bg-primary/40 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                                                        <div className="absolute h-full w-[1px] bg-primary/40 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                                                        <div className="w-12 h-12 rounded-full border border-primary/60 scale-150 opacity-20" />
                                                    </div>
                                                    <div className="absolute bottom-4 left-4 right-4 h-1 bg-white/10 rounded-full overflow-hidden">
                                                        <div className="h-full w-2/3 bg-primary animate-pulse" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-24 text-slate-700 space-y-8">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-white/5 blur-2xl rounded-full" />
                                    <div className="relative w-32 h-32 rounded-[2rem] border-2 border-dashed border-white/5 flex items-center justify-center group overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/5 to-transparent rotate-45 translate-x-12 group-hover:-translate-x-12 transition-transform duration-1000" />
                                        <Eye className="w-12 h-12 opacity-5 text-white" />
                                    </div>
                                </div>
                                <div className="text-center space-y-3">
                                    <p className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">No Optic Feed</p>
                                    <p className="text-[10px] opacity-30 font-medium max-w-[200px] leading-relaxed">Agent has not initiated any visual interactions in the current session.</p>
                                </div>
                            </div>
                        )}

                        <footer className="h-14 border-t border-border/40 flex items-center px-8 justify-between text-[8px] text-slate-600 font-black uppercase tracking-[0.3em] glass relative">
                            <div className="flex items-center gap-3">
                                <div className="w-1 h-1 rounded-full bg-primary" />
                                OS STREAM v2.4
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <Activity className="w-3 h-3 text-primary/60" />
                                    <span>LATENCY: 4.2ms</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Cpu className="w-3 h-3 text-emerald-500/60" />
                                    <span>FPS: 14.1</span>
                                </div>
                            </div>
                        </footer>
                    </div>
                </section>
            </main>
            {isSettingsOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        onClick={() => setIsSettingsOpen(false)}
                    />
                    <div className="relative w-full max-w-xl mx-4 glass-card p-6 space-y-6 border border-white/10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                                    <Settings className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold tracking-tight text-white/90">Settings</h3>
                                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest mt-0.5">
                                        Runtime configuration
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsSettingsOpen(false)}
                                className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                            >
                                Close
                            </button>
                        </div>

                        {settingsLoading && (
                            <div className="flex items-center gap-3 text-slate-500 text-xs">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Loading settings…
                            </div>
                        )}

                        {!settingsLoading && settingsError && (
                            <div className="text-xs text-destructive border border-destructive/30 bg-destructive/5 rounded-xl p-3">
                                {settingsError}
                            </div>
                        )}

                        {!settingsLoading && settingsData && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-400">
                                <div className="space-y-1">
                                    <div className="uppercase tracking-[0.2em] text-[9px] text-slate-600 font-bold">
                                        Agent
                                    </div>
                                    <div className="text-slate-300 font-medium">
                                        {settingsData.agentAvatar ? `${settingsData.agentAvatar} ` : ''}{settingsData.agentName ?? 'Unknown'} ({settingsData.agentId ?? 'n/a'})
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="uppercase tracking-[0.2em] text-[9px] text-slate-600 font-bold">
                                        Default Model
                                    </div>
                                    <div className="text-slate-300 font-medium">{settingsData.defaultModel ?? 'unset'}</div>
                                </div>
                                <div className="space-y-1">
                                    <div className="uppercase tracking-[0.2em] text-[9px] text-slate-600 font-bold">
                                        Gateway Mode
                                    </div>
                                    <div className="text-slate-300 font-medium">{settingsData.gatewayMode ?? 'unknown'}</div>
                                </div>
                                <div className="space-y-1">
                                    <div className="uppercase tracking-[0.2em] text-[9px] text-slate-600 font-bold">
                                        Providers
                                    </div>
                                    <div className="text-slate-300 font-medium">
                                        {(settingsData.providers && settingsData.providers.length > 0)
                                            ? settingsData.providers.join(', ')
                                            : 'none'}
                                    </div>
                                </div>
                                <div className="space-y-1 md:col-span-2">
                                    <div className="uppercase tracking-[0.2em] text-[9px] text-slate-600 font-bold">
                                        Config Path
                                    </div>
                                    <div className="text-slate-300 font-medium break-all">{settingsData.configPath ?? 'unknown'}</div>
                                </div>
                            </div>
                        )}

                        {!settingsLoading && settingsConfig && (
                            <div className="space-y-4">
                                <div className="uppercase tracking-[0.2em] text-[9px] text-slate-600 font-bold">
                                    Provider Status
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-400">
                                    {resolveProviders(settingsConfig).length === 0 && (
                                        <div className="text-slate-500">No providers configured.</div>
                                    )}
                                    {resolveProviders(settingsConfig).map((provider) => {
                                        const entry = resolveProviderEntry(settingsConfig, provider) as { apiKey?: string; models?: unknown } | null;
                                        const hasModels = Array.isArray(entry?.models) && entry?.models?.length > 0;
                                        const hasKey = Boolean(entry?.apiKey);
                                        return (
                                            <div key={provider} className="flex items-center justify-between bg-black/30 border border-white/5 rounded-lg px-3 py-2">
                                                <span className="text-slate-300 font-medium">{provider}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className={cn('text-[9px] uppercase tracking-[0.2em] px-2 py-1 rounded-full border', hasModels ? 'border-emerald-500/30 text-emerald-400' : 'border-slate-600/40 text-slate-500')}>
                                                        {hasModels ? `${(entry?.models as any[]).length} models` : 'no models'}
                                                    </span>
                                                    <span className={cn('text-[9px] uppercase tracking-[0.2em] px-2 py-1 rounded-full border', hasKey ? 'border-primary/30 text-primary' : 'border-slate-600/40 text-slate-500')}>
                                                        {hasKey ? 'auth set' : 'auth missing'}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {!settingsLoading && settingsConfig && (
                            <div className="space-y-4">
                                <div className="uppercase tracking-[0.2em] text-[9px] text-slate-600 font-bold">
                                    Model Provider
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase tracking-widest text-slate-500">Provider</label>
                                        <select
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200"
                                            value={modelProvider}
                                            onChange={(e) => setModelProvider(e.target.value)}
                                        >
                                            {resolveProviderOptions(settingsConfig).map((provider) => (
                                                <option key={provider} value={provider}>{provider}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase tracking-widest text-slate-500">Model</label>
                                        <select
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200"
                                            value={modelId}
                                            onChange={(e) => setModelId(e.target.value)}
                                        >
                                            {resolveModelsForProvider(settingsConfig, modelProvider).map((id) => (
                                                <option key={id} value={id}>{id}</option>
                                            ))}
                                        </select>
                                        {resolveModelsForProvider(settingsConfig, modelProvider).length === 0 && (
                                            <div className="text-[10px] text-slate-500">
                                                No models configured for this provider.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="uppercase tracking-[0.2em] text-[9px] text-slate-600 font-bold">
                                    Auth Provider
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase tracking-widest text-slate-500">Provider</label>
                                        <select
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200"
                                            value={authProvider}
                                            onChange={(e) => setAuthProvider(e.target.value)}
                                        >
                                            {resolveProviderOptions(settingsConfig).map((provider) => (
                                                <option key={provider} value={provider}>{provider}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase tracking-widest text-slate-500">API Key (leave blank to keep)</label>
                                        <input
                                            type="password"
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200"
                                            value={authApiKey}
                                            onChange={(e) => setAuthApiKey(e.target.value)}
                                            placeholder="sk-••••••••••"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase tracking-widest text-slate-500">Base URL</label>
                                        <input
                                            type="text"
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200"
                                            value={providerBaseUrl}
                                            onChange={(e) => setProviderBaseUrl(e.target.value)}
                                            placeholder="https://api.provider.com/v1"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase tracking-widest text-slate-500">API Type</label>
                                        <select
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200"
                                            value={providerApi}
                                            onChange={(e) => setProviderApi(e.target.value)}
                                        >
                                            <option value="">inherit</option>
                                            <option value="openai-completions">openai-completions</option>
                                            <option value="openai-responses">openai-responses</option>
                                            <option value="anthropic-messages">anthropic-messages</option>
                                            <option value="google-generative-ai">google-generative-ai</option>
                                            <option value="github-copilot">github-copilot</option>
                                            <option value="bedrock-converse-stream">bedrock-converse-stream</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase tracking-widest text-slate-500">Auth Mode</label>
                                        <select
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200"
                                            value={providerAuthMode}
                                            onChange={(e) => setProviderAuthMode(e.target.value)}
                                        >
                                            <option value="">inherit</option>
                                            <option value="api-key">api-key</option>
                                            <option value="oauth">oauth</option>
                                            <option value="token">token</option>
                                            <option value="aws-sdk">aws-sdk</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase tracking-widest text-slate-500">Models ({providerModels.length})</label>
                                        <div className="max-h-32 overflow-y-auto border border-white/10 rounded-lg bg-black/30">
                                            {providerModels.length === 0 && (
                                                <div className="px-3 py-2 text-[10px] text-slate-500">No models configured.</div>
                                            )}
                                            {providerModels.map((model) => (
                                                <div key={model.id} className="flex items-center justify-between px-3 py-2 border-b border-white/5 last:border-b-0">
                                                    <div className="text-[10px] text-slate-300">
                                                        <div className="font-semibold">{model.id}</div>
                                                        <div className="text-slate-500">{model.name}</div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeModelFromProvider(model.id)}
                                                        className="text-[9px] uppercase tracking-[0.2em] text-destructive hover:text-destructive/80"
                                                    >
                                                        remove
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase tracking-widest text-slate-500">Add Model</label>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <input
                                            type="text"
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200"
                                            placeholder="model-id"
                                            value={newModelId}
                                            onChange={(e) => setNewModelId(e.target.value)}
                                        />
                                        <input
                                            type="text"
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200"
                                            placeholder="Model name"
                                            value={newModelName}
                                            onChange={(e) => setNewModelName(e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            onClick={addModelToProvider}
                                            className="px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                                        >
                                            Add
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <label className="flex items-center gap-2 text-[10px] text-slate-400">
                                            <input type="checkbox" checked={newModelReasoning} onChange={(e) => setNewModelReasoning(e.target.checked)} />
                                            Reasoning
                                        </label>
                                        <label className="flex items-center gap-2 text-[10px] text-slate-400">
                                            <input type="checkbox" checked={newModelInputText} onChange={(e) => setNewModelInputText(e.target.checked)} />
                                            Input: text
                                        </label>
                                        <label className="flex items-center gap-2 text-[10px] text-slate-400">
                                            <input type="checkbox" checked={newModelInputImage} onChange={(e) => setNewModelInputImage(e.target.checked)} />
                                            Input: image
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200"
                                                placeholder="Context"
                                                value={newModelContextWindow}
                                                onChange={(e) => setNewModelContextWindow(e.target.value)}
                                            />
                                            <input
                                                type="number"
                                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200"
                                                placeholder="MaxTokens"
                                                value={newModelMaxTokens}
                                                onChange={(e) => setNewModelMaxTokens(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={handleSaveSettings}
                                        disabled={settingsSaveState === 'saving'}
                                        className="px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] bg-primary/80 hover:bg-primary text-white transition-colors disabled:opacity-50"
                                    >
                                        {settingsSaveState === 'saving' ? 'Saving…' : 'Apply Changes'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={loadSettings}
                                        className="px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                                    >
                                        Refresh
                                    </button>
                                    {settingsSaveState === 'saved' && (
                                        <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-400">Saved</span>
                                    )}
                                    {settingsSaveState === 'error' && settingsSaveError && (
                                        <span className="text-[10px] uppercase tracking-[0.2em] text-destructive">{settingsSaveError}</span>
                                    )}
                                    {settingsSaveNote && (
                                        <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{settingsSaveNote}</span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
