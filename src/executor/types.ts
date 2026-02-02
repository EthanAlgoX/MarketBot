/*
 * Copyright (C) 2026 MarketBot
 *
 * This file is part of MarketBot.
 */

export type ActionStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";

export interface ActionSchema {
  id: string;
  action: string;
  input: Record<string, any>;
  thought?: string; // LLM's reasoning for this specific step
  observation?: string; // Visual or textual result summary
  screenshots?: string[]; // Base64 or URLs to screenshots
  point?: { x: number; y: number }; // Action coordinates (0-1000)
  actionType?: string; // Type of visual interaction (click, type, etc)
  status?: ActionStatus;
  output?: any;
  error?: string;
  startTime?: number;
  endTime?: number;
}

export interface Intent {
  id: string;
  intent: string;
  steps: ActionSchema[];
  metadata?: Record<string, any>;
}

export interface Skill {
  name: string;
  description: string;
  schema: any; // JSON Schema for validation
  execute(input: any): Promise<any>;
}

export interface ExecutionUpdate {
  intentId: string;
  actionId: string;
  status: ActionStatus;
  thought?: string;
  observation?: string;
  screenshots?: string[];
  point?: { x: number; y: number };
  actionType?: string;
  output?: any;
  error?: string;
}
