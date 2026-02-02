/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import { EventEmitter } from "node:events";
import type { Intent, ActionSchema, Skill, ExecutionUpdate } from "./types.js";

export class TaskExecutor extends EventEmitter {
  private skills = new Map<string, Skill>();

  constructor() {
    super();
  }

  registerSkill(skill: Skill) {
    this.skills.set(skill.name, skill);
  }

  async run(intent: Intent): Promise<void> {
    for (const step of intent.steps) {
      this.emitUpdate(intent.id, step.id, "RUNNING");

      try {
        const skill = this.skills.get(step.action);
        if (!skill) {
          throw new Error(`Skill ${step.action} not found`);
        }

        // TODO: Resolve variable references (e.g., <fetch.market_data.output>)
        const resolvedInput = this.resolveReferences(step.input, intent);

        const output = await skill.execute(resolvedInput);
        step.output = output;
        this.emitUpdate(intent.id, step.id, "COMPLETED", output);
      } catch (err) {
        step.error = String(err);
        this.emitUpdate(intent.id, step.id, "FAILED", undefined, String(err));
        break; // Stop execution on failure
      }
    }
  }

  private resolveReferences(input: any, intent: Intent): any {
    // Basic placeholder implementation
    // In a real system, this would parse strings like "<step_id.output.path>"
    return input;
  }

  private emitUpdate(
    intentId: string,
    actionId: string,
    status: any,
    output?: any,
    error?: string,
  ) {
    const update: ExecutionUpdate = { intentId, actionId, status, output, error };
    this.emit("update", update);
    // This will be piped to WebSocket in the final implementation
  }
}
