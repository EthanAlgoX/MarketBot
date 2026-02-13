import { html, nothing } from "lit";

import { formatMs } from "../format";
import {
  formatCronPayload,
  formatCronSchedule,
  formatCronState,
  formatNextRun,
} from "../presenter";
import type { UiLanguage } from "../storage";
import type { ChannelUiMetaEntry, CronJob, CronRunLogEntry, CronStatus } from "../types";
import type { CronFormState } from "../ui-types";

export type CronProps = {
  language?: UiLanguage;
  loading: boolean;
  status: CronStatus | null;
  jobs: CronJob[];
  error: string | null;
  busy: boolean;
  form: CronFormState;
  channels: string[];
  channelLabels?: Record<string, string>;
  channelMeta?: ChannelUiMetaEntry[];
  runsJobId: string | null;
  runs: CronRunLogEntry[];
  onFormChange: (patch: Partial<CronFormState>) => void;
  onRefresh: () => void;
  onAdd: () => void;
  onToggle: (job: CronJob, enabled: boolean) => void;
  onRun: (job: CronJob) => void;
  onRemove: (job: CronJob) => void;
  onLoadRuns: (jobId: string) => void;
};

const CRON_TEXT = {
  en: {
    lastChannel: "last",
    scheduler: "Scheduler",
    schedulerSub: "Gateway-owned cron scheduler status.",
    enabled: "Enabled",
    yes: "Yes",
    no: "No",
    notAvailable: "n/a",
    jobs: "Jobs",
    nextWake: "Next wake",
    refreshing: "Refreshing…",
    refresh: "Refresh",
    newJob: "New Job",
    newJobSub: "Create a scheduled wakeup or agent run.",
    name: "Name",
    description: "Description",
    agentId: "Agent ID",
    enabledLabel: "Enabled",
    schedule: "Schedule",
    every: "Every",
    at: "At",
    cron: "Cron",
    session: "Session",
    main: "Main",
    isolated: "Isolated",
    wakeMode: "Wake mode",
    nextHeartbeat: "Next heartbeat",
    now: "Now",
    payload: "Payload",
    systemEvent: "System event",
    agentTurn: "Agent turn",
    systemText: "System text",
    agentMessage: "Agent message",
    deliver: "Deliver",
    channel: "Channel",
    to: "To",
    toPlaceholder: "+1555… or chat id",
    timeoutSeconds: "Timeout (seconds)",
    postToMainPrefix: "Post to main prefix",
    saving: "Saving…",
    addJob: "Add job",
    jobsTitle: "Jobs",
    jobsSub: "All scheduled jobs stored in the gateway.",
    noJobs: "No jobs yet.",
    runHistory: "Run history",
    runHistorySubPrefix: "Latest runs for",
    runHistorySelect: "(select a job)",
    selectJobHint: "Select a job to inspect run history.",
    noRuns: "No runs yet.",
    runAt: "Run at",
    unit: "Unit",
    minutes: "Minutes",
    hours: "Hours",
    days: "Days",
    expression: "Expression",
    timezoneOptional: "Timezone (optional)",
    agentPrefix: "Agent:",
    enabledChip: "enabled",
    disabledChip: "disabled",
    disable: "Disable",
    enable: "Enable",
    run: "Run",
    runs: "Runs",
    remove: "Remove",
  },
  zh: {
    lastChannel: "上次渠道",
    scheduler: "调度器",
    schedulerSub: "网关托管的定时调度状态。",
    enabled: "已启用",
    yes: "是",
    no: "否",
    notAvailable: "暂无",
    jobs: "任务数",
    nextWake: "下次唤醒",
    refreshing: "刷新中…",
    refresh: "刷新",
    newJob: "新建任务",
    newJobSub: "创建定时唤醒或代理运行任务。",
    name: "名称",
    description: "描述",
    agentId: "代理 ID",
    enabledLabel: "启用",
    schedule: "调度",
    every: "每隔",
    at: "指定时间",
    cron: "Cron",
    session: "会话",
    main: "主会话",
    isolated: "隔离会话",
    wakeMode: "唤醒模式",
    nextHeartbeat: "下个心跳",
    now: "立即",
    payload: "载荷",
    systemEvent: "系统事件",
    agentTurn: "代理回合",
    systemText: "系统文本",
    agentMessage: "代理消息",
    deliver: "投递",
    channel: "渠道",
    to: "目标",
    toPlaceholder: "+1555… 或 chat id",
    timeoutSeconds: "超时（秒）",
    postToMainPrefix: "回传主会话前缀",
    saving: "保存中…",
    addJob: "添加任务",
    jobsTitle: "任务",
    jobsSub: "网关内保存的全部定时任务。",
    noJobs: "暂无任务。",
    runHistory: "运行历史",
    runHistorySubPrefix: "以下是最新运行记录：",
    runHistorySelect: "（请选择任务）",
    selectJobHint: "请选择任务以查看运行历史。",
    noRuns: "暂无运行记录。",
    runAt: "运行时间",
    unit: "单位",
    minutes: "分钟",
    hours: "小时",
    days: "天",
    expression: "表达式",
    timezoneOptional: "时区（可选）",
    agentPrefix: "代理：",
    enabledChip: "启用",
    disabledChip: "禁用",
    disable: "禁用",
    enable: "启用",
    run: "运行",
    runs: "运行记录",
    remove: "移除",
  },
} as const;

function buildChannelOptions(props: CronProps): string[] {
  const options = ["last", ...props.channels.filter(Boolean)];
  const current = props.form.channel?.trim();
  if (current && !options.includes(current)) {
    options.push(current);
  }
  const seen = new Set<string>();
  return options.filter((value) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function resolveChannelLabel(
  props: CronProps,
  channel: string,
  text: (typeof CRON_TEXT)["en"],
): string {
  if (channel === "last") return text.lastChannel;
  const meta = props.channelMeta?.find((entry) => entry.id === channel);
  if (meta?.label) return meta.label;
  return props.channelLabels?.[channel] ?? channel;
}

export function renderCron(props: CronProps) {
  const language = props.language ?? "en";
  const text = CRON_TEXT[language] ?? CRON_TEXT.en;
  const channelOptions = buildChannelOptions(props);
  return html`
    <section class="grid grid-cols-2">
      <div class="card">
        <div class="card-title">${text.scheduler}</div>
        <div class="card-sub">${text.schedulerSub}</div>
        <div class="stat-grid" style="margin-top: 16px;">
          <div class="stat">
            <div class="stat-label">${text.enabled}</div>
            <div class="stat-value">
              ${props.status
                ? props.status.enabled
                  ? text.yes
                  : text.no
                : text.notAvailable}
            </div>
          </div>
          <div class="stat">
            <div class="stat-label">${text.jobs}</div>
            <div class="stat-value">${props.status?.jobs ?? text.notAvailable}</div>
          </div>
          <div class="stat">
            <div class="stat-label">${text.nextWake}</div>
            <div class="stat-value">${formatNextRun(props.status?.nextWakeAtMs ?? null)}</div>
          </div>
        </div>
        <div class="row" style="margin-top: 12px;">
          <button class="btn" ?disabled=${props.loading} @click=${props.onRefresh}>
            ${props.loading ? text.refreshing : text.refresh}
          </button>
          ${props.error ? html`<span class="muted">${props.error}</span>` : nothing}
        </div>
      </div>

      <div class="card">
        <div class="card-title">${text.newJob}</div>
        <div class="card-sub">${text.newJobSub}</div>
        <div class="form-grid" style="margin-top: 16px;">
          <label class="field">
            <span>${text.name}</span>
            <input
              .value=${props.form.name}
              @input=${(e: Event) =>
                props.onFormChange({ name: (e.target as HTMLInputElement).value })}
            />
          </label>
          <label class="field">
            <span>${text.description}</span>
            <input
              .value=${props.form.description}
              @input=${(e: Event) =>
                props.onFormChange({ description: (e.target as HTMLInputElement).value })}
            />
          </label>
          <label class="field">
            <span>${text.agentId}</span>
            <input
              .value=${props.form.agentId}
              @input=${(e: Event) =>
                props.onFormChange({ agentId: (e.target as HTMLInputElement).value })}
              placeholder="default"
            />
          </label>
          <label class="field checkbox">
            <span>${text.enabledLabel}</span>
            <input
              type="checkbox"
              .checked=${props.form.enabled}
              @change=${(e: Event) =>
                props.onFormChange({ enabled: (e.target as HTMLInputElement).checked })}
            />
          </label>
          <label class="field">
            <span>${text.schedule}</span>
            <select
              .value=${props.form.scheduleKind}
              @change=${(e: Event) =>
                props.onFormChange({
                  scheduleKind: (e.target as HTMLSelectElement).value as CronFormState["scheduleKind"],
                })}
            >
              <option value="every">${text.every}</option>
              <option value="at">${text.at}</option>
              <option value="cron">${text.cron}</option>
            </select>
          </label>
        </div>
        ${renderScheduleFields(props, text)}
        <div class="form-grid" style="margin-top: 12px;">
          <label class="field">
            <span>${text.session}</span>
            <select
              .value=${props.form.sessionTarget}
              @change=${(e: Event) =>
                props.onFormChange({
                  sessionTarget: (e.target as HTMLSelectElement).value as CronFormState["sessionTarget"],
                })}
            >
              <option value="main">${text.main}</option>
              <option value="isolated">${text.isolated}</option>
            </select>
          </label>
          <label class="field">
            <span>${text.wakeMode}</span>
            <select
              .value=${props.form.wakeMode}
              @change=${(e: Event) =>
                props.onFormChange({
                  wakeMode: (e.target as HTMLSelectElement).value as CronFormState["wakeMode"],
                })}
            >
              <option value="next-heartbeat">${text.nextHeartbeat}</option>
              <option value="now">${text.now}</option>
            </select>
          </label>
          <label class="field">
            <span>${text.payload}</span>
            <select
              .value=${props.form.payloadKind}
              @change=${(e: Event) =>
                props.onFormChange({
                  payloadKind: (e.target as HTMLSelectElement).value as CronFormState["payloadKind"],
                })}
            >
              <option value="systemEvent">${text.systemEvent}</option>
              <option value="agentTurn">${text.agentTurn}</option>
            </select>
          </label>
        </div>
        <label class="field" style="margin-top: 12px;">
          <span>${props.form.payloadKind === "systemEvent" ? text.systemText : text.agentMessage}</span>
          <textarea
            .value=${props.form.payloadText}
            @input=${(e: Event) =>
              props.onFormChange({
                payloadText: (e.target as HTMLTextAreaElement).value,
              })}
            rows="4"
          ></textarea>
        </label>
	          ${props.form.payloadKind === "agentTurn"
	          ? html`
	              <div class="form-grid" style="margin-top: 12px;">
                <label class="field checkbox">
                  <span>${text.deliver}</span>
                  <input
                    type="checkbox"
                    .checked=${props.form.deliver}
                    @change=${(e: Event) =>
                      props.onFormChange({
                        deliver: (e.target as HTMLInputElement).checked,
                      })}
                  />
	                </label>
	                <label class="field">
	                  <span>${text.channel}</span>
	                  <select
	                    .value=${props.form.channel || "last"}
	                    @change=${(e: Event) =>
	                      props.onFormChange({
	                        channel: (e.target as HTMLSelectElement).value as CronFormState["channel"],
	                      })}
	                  >
	                    ${channelOptions.map(
                        (channel) =>
                          html`<option value=${channel}>
                            ${resolveChannelLabel(props, channel, text)}
                          </option>`,
                      )}
                  </select>
                </label>
                <label class="field">
                  <span>${text.to}</span>
                  <input
                    .value=${props.form.to}
                    @input=${(e: Event) =>
                      props.onFormChange({ to: (e.target as HTMLInputElement).value })}
                    placeholder=${text.toPlaceholder}
                  />
                </label>
                <label class="field">
                  <span>${text.timeoutSeconds}</span>
                  <input
                    .value=${props.form.timeoutSeconds}
                    @input=${(e: Event) =>
                      props.onFormChange({
                        timeoutSeconds: (e.target as HTMLInputElement).value,
                      })}
                  />
                </label>
                ${props.form.sessionTarget === "isolated"
                  ? html`
                      <label class="field">
                        <span>${text.postToMainPrefix}</span>
                        <input
                          .value=${props.form.postToMainPrefix}
                          @input=${(e: Event) =>
                            props.onFormChange({
                              postToMainPrefix: (e.target as HTMLInputElement).value,
                            })}
                        />
                      </label>
                    `
                  : nothing}
              </div>
            `
          : nothing}
        <div class="row" style="margin-top: 14px;">
          <button class="btn primary" ?disabled=${props.busy} @click=${props.onAdd}>
            ${props.busy ? text.saving : text.addJob}
          </button>
        </div>
      </div>
    </section>

    <section class="card" style="margin-top: 18px;">
      <div class="card-title">${text.jobsTitle}</div>
      <div class="card-sub">${text.jobsSub}</div>
      ${props.jobs.length === 0
        ? html`<div class="muted" style="margin-top: 12px;">${text.noJobs}</div>`
        : html`
            <div class="list" style="margin-top: 12px;">
              ${props.jobs.map((job) => renderJob(job, props, text))}
            </div>
          `}
    </section>

    <section class="card" style="margin-top: 18px;">
      <div class="card-title">${text.runHistory}</div>
      <div class="card-sub">${text.runHistorySubPrefix} ${props.runsJobId ?? text.runHistorySelect}.</div>
      ${props.runsJobId == null
        ? html`
            <div class="muted" style="margin-top: 12px;">
              ${text.selectJobHint}
            </div>
          `
        : props.runs.length === 0
          ? html`<div class="muted" style="margin-top: 12px;">${text.noRuns}</div>`
          : html`
              <div class="list" style="margin-top: 12px;">
                ${props.runs.map((entry) => renderRun(entry))}
              </div>
            `}
    </section>
  `;
}

function renderScheduleFields(props: CronProps, text: (typeof CRON_TEXT)["en"]) {
  const form = props.form;
  if (form.scheduleKind === "at") {
    return html`
      <label class="field" style="margin-top: 12px;">
        <span>${text.runAt}</span>
        <input
          type="datetime-local"
          .value=${form.scheduleAt}
          @input=${(e: Event) =>
            props.onFormChange({
              scheduleAt: (e.target as HTMLInputElement).value,
            })}
        />
      </label>
    `;
  }
  if (form.scheduleKind === "every") {
    return html`
      <div class="form-grid" style="margin-top: 12px;">
        <label class="field">
          <span>${text.every}</span>
          <input
            .value=${form.everyAmount}
            @input=${(e: Event) =>
              props.onFormChange({
                everyAmount: (e.target as HTMLInputElement).value,
              })}
          />
        </label>
        <label class="field">
          <span>${text.unit}</span>
          <select
            .value=${form.everyUnit}
            @change=${(e: Event) =>
              props.onFormChange({
                everyUnit: (e.target as HTMLSelectElement).value as CronFormState["everyUnit"],
              })}
          >
            <option value="minutes">${text.minutes}</option>
            <option value="hours">${text.hours}</option>
            <option value="days">${text.days}</option>
          </select>
        </label>
      </div>
    `;
  }
  return html`
    <div class="form-grid" style="margin-top: 12px;">
      <label class="field">
        <span>${text.expression}</span>
        <input
          .value=${form.cronExpr}
          @input=${(e: Event) =>
            props.onFormChange({ cronExpr: (e.target as HTMLInputElement).value })}
        />
      </label>
      <label class="field">
        <span>${text.timezoneOptional}</span>
        <input
          .value=${form.cronTz}
          @input=${(e: Event) =>
            props.onFormChange({ cronTz: (e.target as HTMLInputElement).value })}
        />
      </label>
    </div>
  `;
}

function renderJob(job: CronJob, props: CronProps, text: (typeof CRON_TEXT)["en"]) {
  const isSelected = props.runsJobId === job.id;
  const itemClass = `list-item list-item-clickable${isSelected ? " list-item-selected" : ""}`;
  return html`
    <div class=${itemClass} @click=${() => props.onLoadRuns(job.id)}>
      <div class="list-main">
        <div class="list-title">${job.name}</div>
        <div class="list-sub">${formatCronSchedule(job)}</div>
        <div class="muted">${formatCronPayload(job)}</div>
        ${job.agentId ? html`<div class="muted">${text.agentPrefix} ${job.agentId}</div>` : nothing}
        <div class="chip-row" style="margin-top: 6px;">
          <span class="chip">${job.enabled ? text.enabledChip : text.disabledChip}</span>
          <span class="chip">${job.sessionTarget}</span>
          <span class="chip">${job.wakeMode}</span>
        </div>
      </div>
      <div class="list-meta">
        <div>${formatCronState(job)}</div>
        <div class="row" style="justify-content: flex-end; margin-top: 8px;">
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              props.onToggle(job, !job.enabled);
            }}
          >
            ${job.enabled ? text.disable : text.enable}
          </button>
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              props.onRun(job);
            }}
          >
            ${text.run}
          </button>
          <button
            class="btn"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              props.onLoadRuns(job.id);
            }}
          >
            ${text.runs}
          </button>
          <button
            class="btn danger"
            ?disabled=${props.busy}
            @click=${(event: Event) => {
              event.stopPropagation();
              props.onRemove(job);
            }}
          >
            ${text.remove}
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderRun(entry: CronRunLogEntry) {
  return html`
    <div class="list-item">
      <div class="list-main">
        <div class="list-title">${entry.status}</div>
        <div class="list-sub">${entry.summary ?? ""}</div>
      </div>
      <div class="list-meta">
        <div>${formatMs(entry.ts)}</div>
        <div class="muted">${entry.durationMs ?? 0}ms</div>
        ${entry.error ? html`<div class="muted">${entry.error}</div>` : nothing}
      </div>
    </div>
  `;
}
