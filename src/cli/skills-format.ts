import type { SkillStatusEntry, SkillStatusReport } from "../skills/status.js";

type SkillsCheckOptions = {
  json?: boolean;
  eligible?: boolean;
  verbose?: boolean;
};

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
    const missing = formatMissing(skill);
    if (missing) lines.push(`Missing: ${missing}`);
  }
  lines.push(`Path: ${skill.filePath}`);
  return lines.join("\n");
}

export function formatSkillsCheck(report: SkillStatusReport, opts: SkillsCheckOptions = {}): string {
  const skills = opts.eligible ? report.skills.filter((s) => s.eligible) : report.skills;

  if (opts.json) {
    return JSON.stringify({
      workspaceDir: report.workspaceDir,
      managedSkillsDir: report.managedSkillsDir,
      skills: skills.map((skill) => ({
        name: skill.name,
        skillKey: skill.skillKey,
        description: skill.description,
        source: skill.source,
        eligible: skill.eligible,
        disabled: skill.disabled,
        blockedByAllowlist: skill.blockedByAllowlist,
        missing: skill.missing,
      })),
    }, null, 2);
  }

  if (skills.length === 0) {
    return opts.eligible ? "No eligible skills found." : "No skills found.";
  }

  const lines: string[] = [];
  lines.push(`Skills check (${skills.filter((s) => s.eligible).length}/${skills.length} ready)`);

  for (const skill of skills) {
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

    const missing = formatMissing(skill);
    if (missing && (opts.verbose || !skill.eligible)) {
      lines.push(`  missing: ${missing}`);
    }

    if (opts.verbose) {
      lines.push(`  source: ${skill.source}`);
      lines.push(`  path: ${skill.filePath}`);
    }
  }

  return lines.join("\n");
}

function formatMissing(skill: SkillStatusEntry): string {
  const missing: string[] = [];
  if (skill.missing.bins.length > 0) missing.push(`bins=${skill.missing.bins.join(",")}`);
  if (skill.missing.anyBins.length > 0) missing.push(`anyBins=${skill.missing.anyBins.join(",")}`);
  if (skill.missing.env.length > 0) missing.push(`env=${skill.missing.env.join(",")}`);
  if (skill.missing.config.length > 0) missing.push(`config=${skill.missing.config.join(",")}`);
  if (skill.missing.os.length > 0) missing.push(`os=${skill.missing.os.join(",")}`);
  return missing.join("; ");
}
