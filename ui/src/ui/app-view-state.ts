import type { GatewayBrowserClient, GatewayHelloOk } from "./gateway";
import type { Tab } from "./navigation";
import type { UiSettings } from "./storage";
import type { ThemeMode } from "./theme";
import type { ThemeTransitionContext } from "./theme-transition";
import type {
  AgentsListResult,
  ChannelsStatusSnapshot,
  ConfigSnapshot,
  ConfigUiHints,
  CronJob,
  CronRunLogEntry,
  CronStatus,
  LogEntry,
  LogLevel,
  NostrProfile,
  SessionsListResult,
  TraceRunEvent,
  TraceRunMeta,
} from "./types";
import type { ChatAttachment, ChatQueueItem, CronFormState } from "./ui-types";
import type { EventLogEntry } from "./app-events";
import type {
  ExecApprovalsFile,
  ExecApprovalsSnapshot,
} from "./controllers/exec-approvals";
import type { ExecApprovalRequest } from "./controllers/exec-approval";
import type { NostrProfileFormState } from "./views/channels.nostr-profile-form";

import type { DailyStockRunResult, MarketDataSnapshot, MarketDataStatus } from "./types";

export type AppViewState = {
  settings: UiSettings;
  password: string;
  tab: Tab;
  onboarding: boolean;
  embed: boolean;
  basePath: string;
  connected: boolean;
  theme: ThemeMode;
  themeResolved: "light" | "dark";
  hello: GatewayHelloOk | null;
  lastError: string | null;
  eventLog: EventLogEntry[];
  assistantName: string;
  assistantAvatar: string | null;
  assistantAgentId: string | null;
  sessionKey: string;
  chatLoading: boolean;
  chatSending: boolean;
  chatMessage: string;
  chatAttachments: ChatAttachment[];
  chatMessages: unknown[];
  chatToolMessages: unknown[];
  chatStream: string | null;
  chatRunId: string | null;
  chatAvatarUrl: string | null;
  chatThinkingLevel: string | null;
  chatQueue: ChatQueueItem[];
  chatStreamStartedAt: number | null;
  refreshSessionsAfterChat: Set<string>;
  compactionStatus: import("./app-tool-stream").CompactionStatus | null;
  sidebarOpen: boolean;
  sidebarContent: string | null;
  sidebarError: string | null;
  splitRatio: number;
  runId: string | null;

  execApprovalsLoading: boolean;
  execApprovalsSaving: boolean;
  execApprovalsDirty: boolean;
  execApprovalsSnapshot: ExecApprovalsSnapshot | null;
  execApprovalsForm: ExecApprovalsFile | null;
  execApprovalsSelectedAgent: string | null;

  execApprovalQueue: ExecApprovalRequest[];
  execApprovalBusy: boolean;
  execApprovalError: string | null;
  pendingGatewayUrl: string | null;
  configLoading: boolean;
  configRaw: string;
  configRawOriginal: string;
  configValid: boolean | null;
  configIssues: unknown[];
  configSaving: boolean;
  configApplying: boolean;
  updateRunning: boolean;
  applySessionKey: string;
  configSnapshot: ConfigSnapshot | null;
  configSchema: unknown | null;
  configSchemaVersion: string | null;
  configSchemaLoading: boolean;
  configUiHints: ConfigUiHints;
  configForm: Record<string, unknown> | null;
  configFormOriginal: Record<string, unknown> | null;
  configFormMode: "form" | "raw";
  configSearchQuery: string;
  configActiveSection: string | null;
  configActiveSubsection: string | null;
  channelsLoading: boolean;
  channelsSnapshot: ChannelsStatusSnapshot | null;
  channelsError: string | null;
  channelsLastSuccess: number | null;
  whatsappLoginMessage: string | null;
  whatsappLoginQrDataUrl: string | null;
  whatsappLoginConnected: boolean | null;
  whatsappBusy: boolean;
  nostrProfileFormState: NostrProfileFormState | null;
  nostrProfileAccountId: string | null;
  configFormDirty: boolean;
  agentsLoading: boolean;
  agentsList: AgentsListResult | null;
  agentsError: string | null;

  sessionsLoading: boolean;
  sessionsResult: SessionsListResult | null;
  sessionsError: string | null;
  sessionsFilterActive: string;
  sessionsFilterLimit: string;
  sessionsIncludeGlobal: boolean;
  sessionsIncludeUnknown: boolean;
  cronLoading: boolean;
  cronJobs: CronJob[];
  cronStatus: CronStatus | null;
  cronError: string | null;
  cronForm: CronFormState;
  cronRunsJobId: string | null;
  cronRuns: CronRunLogEntry[];
  cronBusy: boolean;

  logsLoading: boolean;
  logsError: string | null;
  logsCursor: number | null;
  logsFile: string | null;
  logsEntries: LogEntry[];
  logsFilterText: string;
  logsLevelFilters: Record<LogLevel, boolean>;
  logsAutoFollow: boolean;
  logsTruncated: boolean;
  logsLastFetchAt: number | null;
  logsLimit: number;
  logsMaxBytes: number;
  runsLoading: boolean;
  runsError: string | null;
  runs: TraceRunMeta[];
  runsSelectedRunId: string | null;
  runLoading: boolean;
  runError: string | null;
  runEvents: TraceRunEvent[];
  runTruncated: boolean;
  runStreamsFilter: Record<string, boolean>;
  runReplayIndex: number;
  client: GatewayBrowserClient | null;
  stocksLoading: boolean;
  stocksRunning: boolean;
  stocksError: string | null;
  stocksWatchlistText: string;
  stocksTimeframe: string;
  stocksReportType: "simple" | "full";
  stocksIncludeFundamentals: boolean;
  stocksNewsLimit: string;
  stocksLocale: string;
  stocksLast: DailyStockRunResult | null;
  marketDataLoading: boolean;
  marketDataError: string | null;
  marketDataSymbolsText: string;
  marketDataTimeframe: string;
  marketDataNewsLimit: string;
  marketDataActiveSymbol: string;
  marketDataStatus: MarketDataStatus | null;
  marketDataSnapshot: MarketDataSnapshot | null;
  connect: () => void;
  setTab: (tab: Tab) => void;
  setTheme: (theme: ThemeMode, context?: ThemeTransitionContext) => void;
  applySettings: (next: UiSettings) => void;
  loadOverview: () => Promise<void>;
  loadAssistantIdentity: () => Promise<void>;
  loadCron: () => Promise<void>;
  handleWhatsAppStart: (force: boolean) => Promise<void>;
  handleWhatsAppWait: () => Promise<void>;
  handleWhatsAppLogout: () => Promise<void>;
  handleChannelConfigSave: () => Promise<void>;
  handleChannelConfigReload: () => Promise<void>;
  handleNostrProfileEdit: (accountId: string, profile: NostrProfile | null) => void;
  handleNostrProfileCancel: () => void;
  handleNostrProfileFieldChange: (field: keyof NostrProfile, value: string) => void;
  handleNostrProfileSave: () => Promise<void>;
  handleNostrProfileImport: () => Promise<void>;
  handleNostrProfileToggleAdvanced: () => void;
  handleExecApprovalDecision: (decision: "allow-once" | "allow-always" | "deny") => Promise<void>;
  handleGatewayUrlConfirm: () => void;
  handleGatewayUrlCancel: () => void;
  setPassword: (next: string) => void;
  setSessionKey: (next: string) => void;
  setChatMessage: (next: string) => void;

  handleChatSelectQueueItem: (id: string) => void;
  handleChatDropQueueItem: (id: string) => void;
  handleChatClearQueue: () => void;
  handleLogsFilterChange: (next: string) => void;
  handleLogsLevelFilterToggle: (level: LogLevel) => void;
  handleLogsAutoFollowToggle: (next: boolean) => void;

  loadStocks: () => Promise<void>;
  saveStocksWatchlist: () => Promise<void>;
  runStocks: () => Promise<void>;
  loadMarketDataStatus: () => Promise<void>;
  runMarketDataSnapshot: () => Promise<void>;

  resetToolStream: () => void;
  resetChatScroll: () => void;
  handleChatScroll: (event: Event) => void;
  handleSendChat: (messageOverride?: string, opts?: any) => Promise<void>;
  handleAbortChat: () => Promise<void>;
  removeQueuedMessage: (id: string) => void;
  handleOpenSidebar: (content: string) => void;
  handleCloseSidebar: () => void;
  handleSplitRatioChange: (ratio: number) => void;
  exportLogs: (lines: string[], label: string) => void;
  handleLogsScroll: (event: Event) => void;
};
