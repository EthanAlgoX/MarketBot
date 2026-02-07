/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

import { EventEmitter } from "node:events";
import type { Intent, Skill, ExecutionUpdate, ActionStatus } from "./types.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const logger = createSubsystemLogger("executor");

export class TaskExecutor extends EventEmitter {
  private skills = new Map<string, Skill>();

  registerSkill(skill: Skill) {
    this.skills.set(skill.name, skill);
  }

  async run(intent: Intent): Promise<void> {
    logger.info(`Starting execution of intent: ${intent.id} (${intent.intent})`);

    for (const step of intent.steps) {
      step.status = "RUNNING";
      step.startTime = Date.now();
      this.emitUpdate(intent.id, step.id, "RUNNING", undefined, undefined, step.thought);

      try {
        let actionName = step.action;
        let subAction: string | undefined;

        if (actionName.includes(".") && !this.skills.has(actionName)) {
          const parts = actionName.split(".");
          actionName = parts[0];
          subAction = parts[1];
        }

        const skill = this.skills.get(actionName);
        if (!skill) {
          throw new Error(`Skill ${actionName} not found`);
        }

        const resolvedInput = this.resolveReferences(step.input, intent);
        if (subAction && typeof resolvedInput === "object") {
          resolvedInput.action = subAction;
        }

        logger.debug(
          `Executing action ${actionName} (sub: ${subAction || "none"}) with input`,
          resolvedInput,
        );
        const output = await skill.execute(resolvedInput);

        step.status = "COMPLETED";
        step.output = output;
        step.endTime = Date.now();

        // Extract screenshots from tool result content
        if (output && Array.isArray(output.content)) {
          step.screenshots = output.content
            .filter((c: any) => c.type === "image")
            .map((c: any) => c.image || c.path);
        }

        // If it's a browser action and we don't have a screenshot yet, try to take one
        if (step.action === "browser" && (!step.screenshots || step.screenshots.length === 0)) {
          try {
            const browserSkill = this.skills.get("browser");
            if (browserSkill) {
              const screenshot = await browserSkill.execute({
                action: "screenshot",
                profile: resolvedInput.profile,
              });
              if (screenshot && Array.isArray(screenshot.content)) {
                step.screenshots = screenshot.content
                  .filter((c: any) => c.type === "image")
                  .map((c: any) => c.path || c.image);
              }
            }
          } catch (e) {
            logger.warn(`Failed to capture automatic screenshot: ${String(e)}`);
          }
        }

        // Add basic observation summary if not provided
        if (!step.observation) {
          step.observation = `Successfully executed ${step.action}`;
        }

        // Extract visual markers if present in input (UI-TARS style [x, y])
        if (resolvedInput && typeof resolvedInput === "object") {
          if (Array.isArray(resolvedInput.point)) {
            step.point = { x: resolvedInput.point[0], y: resolvedInput.point[1] };
          } else if (resolvedInput.x !== undefined && resolvedInput.y !== undefined) {
            step.point = { x: Number(resolvedInput.x), y: Number(resolvedInput.y) };
          }
          step.actionType =
            (resolvedInput.actionType as string) || (resolvedInput.action as string);
        }

        this.emitUpdate(
          intent.id,
          step.id,
          "COMPLETED",
          output,
          undefined,
          step.thought,
          step.observation,
          step.screenshots,
          step.point,
          step.actionType,
        );
      } catch (err) {
        step.status = "FAILED";
        step.error = String(err);
        step.endTime = Date.now();
        this.emitUpdate(intent.id, step.id, "FAILED", undefined, String(err), step.thought);
        logger.error(`Action ${step.id} (${step.action}) failed: ${String(err)}`);
        continue; // Allow later steps to run even if one fails
      }
    }

    logger.info(`Execution finished for intent: ${intent.id}`);
  }

  private resolveReferences(input: any, intent: Intent): any {
    if (typeof input !== "object" || input === null) {
      if (typeof input === "string") {
        return this.resolveString(input, intent);
      }
      return input;
    }

    if (Array.isArray(input)) {
      return input.map((item) => this.resolveReferences(item, intent));
    }

    const resolved: any = {};
    for (const [key, value] of Object.entries(input)) {
      resolved[key] = this.resolveReferences(value, intent);
    }
    return resolved;
  }

  private resolveString(val: string, intent: Intent): string {
    // Regex for <step_id.output.path>
    return val.replace(/<([^.]+)\.output\.?([^>]*)>/g, (_, stepId, jsonPath) => {
      const step = intent.steps.find((s) => s.id === stepId);
      if (!step || step.status !== "COMPLETED") {
        return `<MISSING_REF:${stepId}>`;
      }

      const output = step.output;
      if (!jsonPath) {
        return typeof output === "object" ? JSON.stringify(output) : String(output);
      }

      // Simple JSON path resolution
      const parts = jsonPath.split(".").filter(Boolean);
      let target = output;
      for (const part of parts) {
        if (target && typeof target === "object" && part in target) {
          target = target[part];
        } else {
          return `<MISSING_PATH:${stepId}.${jsonPath}>`;
        }
      }
      return typeof target === "object" ? JSON.stringify(target) : String(target);
    });
  }

  private emitUpdate(
    intentId: string,
    actionId: string,
    status: ActionStatus,
    output?: any,
    error?: string,
    thought?: string,
    observation?: string,
    screenshots?: string[],
    point?: { x: number; y: number },
    actionType?: string,
  ) {
    const update: ExecutionUpdate = {
      intentId,
      actionId,
      status,
      output,
      error,
      thought,
      observation,
      screenshots,
      point,
      actionType,
    };
    this.emit("update", update);
  }
}
