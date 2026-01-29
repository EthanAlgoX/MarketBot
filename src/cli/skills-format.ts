import type { SkillStatusReport } from "../skills/status.js";

export function formatSkillsList(report: SkillStatusReport, opts: { json?: boolean } = {}): string {
  if (opts.json) {
    return JSON.stringify(report, null, 2);
  }

  if (report.skills.length === 0) {
    return "No skills found.";
  }

  const lines: string[] = [];
  lines.push(`Skills (${report.skills.filter((s) => s.eligible).length}/${report.skills.length} ready)`);

  for (const skill of report.skills) {
    const status = skill.disabled
      ? "disabled"
      : skill.blockedByAllowlist
        ? "blocked"
        : skill.eligible
          ? "ready"
          : "missing";
    const marker = skill.emoji ?? "[skill]";
    const description = skill.description ? ` - ${skill.description}` : "";
    lines.push(`${marker} ${skill.name}${description} (${status})`);
  }

  return lines.join("\n");
}

export function formatSkillInfo(report: SkillStatusReport, name: string, opts: { json?: boolean } = {}): string {
  const skill = report.skills.find((entry) => entry.name === name);
  if (!skill) {
    return opts.json ? JSON.stringify({ error: "not found", skill: name }, null, 2) : `Skill ${name} not found.`;
  }

  if (opts.json) {
    return JSON.stringify(skill, null, 2);
  }

  const lines: string[] = [];
  lines.push(`${skill.emoji ?? "[skill]"} ${skill.name}`);
  if (skill.description) lines.push(skill.description);
  lines.push(`Skill Key: ${skill.skillKey}`);
  lines.push(`Source: ${skill.source}`);
  lines.push(`Eligible: ${skill.eligible ? "yes" : "no"}`);
  if (skill.disabled) lines.push("Status: disabled");
  if (skill.blockedByAllowlist) lines.push("Status: blocked");
  if (skill.invocation) {
    const invokable = skill.invocation.userInvocable ?? true;
    const modelAllowed = !(skill.invocation.disableModelInvocation ?? false);
    lines.push(`Invocation: user=${invokable ? "yes" : "no"}, model=${modelAllowed ? "yes" : "no"}`);
  }
  if (skill.commands && skill.commands.length > 0) {
    lines.push("Commands:");
    for (const cmd of skill.commands) {
      const description = cmd.description ? ` - ${cmd.description}` : "";
      const dispatch = cmd.dispatch ? ` (${cmd.dispatch.toolName})` : "";
      lines.push(`  - ${cmd.name}${description}${dispatch}`);
    }
  }
  if (skill.install && skill.install.length > 0) {
    lines.push("Install:");
    for (const spec of skill.install) {
      const label = spec.label ? ` - ${spec.label}` : "";
      const bins = spec.bins && spec.bins.length > 0 ? ` [bins: ${spec.bins.join(", ")}]` : "";
      lines.push(`  - ${spec.kind}${label}${bins}`);
    }
  }
  if (!skill.eligible) {
    const missing = [
      ...skill.missing.bins.map((item) => `bin:${item}`),
      ...skill.missing.anyBins.map((item) => `anyBin:${item}`),
      ...skill.missing.env.map((item) => `env:${item}`),
      ...skill.missing.os.map((item) => `os:${item}`),
      ...skill.missing.config.map((item) => `config:${item}`),
    ];
    if (missing.length > 0) lines.push(`Missing: ${missing.join(", ")}`);
  }
  lines.push(`Path: ${skill.filePath}`);
  return lines.join("\n");
}
