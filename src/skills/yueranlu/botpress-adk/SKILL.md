---
name: adk
description: A guide to build AI bots with Botpress's Agent Development Kit (ADK)
version: 1.0.0
author: yueranlu
tags: [botpress, adk, chatbot, ai, typescript]
homepage: https://github.com/botpress/adk
---

# Botpress ADK Development Guide

A comprehensive guide for building AI bots with the Botpress Agent Development Kit (ADK).

## When to Use

- User asks to build a Botpress bot or chatbot
- User mentions ADK, Agent Development Kit, or Botpress
- User wants to create actions, tools, workflows, conversations, tables, triggers, or knowledge bases
- User needs help with `adk` CLI commands (init, dev, deploy, link)
- User has ADK-related errors or needs troubleshooting
- User asks about bot configuration, state management, or integrations

## Quick Reference

The ADK is a **convention-based TypeScript framework** where **file structure maps directly to bot behavior**.

**Your role:** Guide users through the entire bot development lifecycle - from project setup to deployment. Use the patterns and code examples in this skill to write correct, working ADK code.

**Key principle:** In ADK, **where you put files matters**. Each component type has a specific `src/` subdirectory, and files are auto-discovered based on location.

## How to Use This Skill

**This skill is your primary reference for building Botpress bots.** When a user asks you to build something with the ADK:

1. **Identify what they need** - Is it a new bot, a feature (action, tool, workflow), data storage (table), or event handling (trigger)?
2. **Check the correct directory** - Each component type goes in a specific `src/` subdirectory
3. **Use the patterns below** - Follow the code examples exactly, they represent the correct ADK conventions
4. **Run `adk --help`** - For CLI commands not covered here, or `adk <command> --help` for specific help

**Decision Guide - What Component to Create:**

| User Wants To... | Create This | Location |
|------------------|-------------|----------|
| Handle user messages | Conversation | `src/conversations/` |
| Add a function the AI can call | Tool | `src/tools/` |
| Add reusable business logic | Action | `src/actions/` |
| Run background/scheduled tasks | Workflow | `src/workflows/` |
| Store structured data | Table | `src/tables/` |
| React to events (user created, etc.) | Trigger | `src/triggers/` |
| Give AI access to docs/data | Knowledge Base | `src/knowledge/` |
| Connect external service (Slack, etc.) | Integration | `adk add <name>` |

**If the information in this skill isn't enough**, fetch the corresponding GitHub reference file (links provided in each section) for more detailed specifications.

## Important: ADK is AI-Native

The ADK does **NOT** use traditional chatbot patterns. Don't create intents, entities, or dialog flows.

**Instead of:**
- Defining intents (`greet`, `orderPizza`, `checkStatus`)
- Training entity extraction (`@pizzaSize`, `@toppings`)
- Manually routing to intent handlers

**ADK uses:**
- `execute()` - The AI understands user intent naturally from instructions
- Tools - AI autonomously decides when to call your functions
- `zai.extract()` - Schema-based structured data extraction
- Knowledge bases - RAG for grounding responses in your docs

**Docs:** https://www.botpress.com/docs/adk/
**GitHub:** https://github.com/botpress/skills/tree/master/skills/adk

---

## Prerequisites & Installation

Before using the ADK, ensure the user has:

- **Botpress Account** - Create at https://app.botpress.cloud
- **Node.js v22.0.0+** - Check with `node --version`
- **Package Manager** - bun (recommended), pnpm, yarn, or npm

**Install the ADK CLI:**

macOS & Linux:
```bash
curl -fsSL https://github.com/botpress/adk/releases/latest/download/install.sh | bash
```

Windows (PowerShell):
```powershell
powershell -c "irm https://github.com/botpress/adk/releases/latest/download/install.ps1 | iex"
```

**Verify installation:**
```bash
adk --version
```

If installation fails, check https://github.com/botpress/adk/releases for manual download options.

**Docs:** https://www.botpress.com/docs/adk/quickstart
**GitHub:** https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/cli.md

---

## Quick Start

Once the ADK CLI is installed, create a new bot:

```bash
adk init my-bot         # Create project (choose "Hello World" template for beginners)
cd my-bot
npm install             # Or bun/pnpm/yarn
adk login               # Authenticate with Botpress Cloud
adk add chat            # Add the chat integration for testing
adk dev                 # Start dev server with hot reload
adk chat                # Test in CLI (run in separate terminal)
adk deploy              # Deploy to production when ready
```

The visual console at **http://localhost:3001/** lets you configure integrations and test the bot.

**Docs:** https://www.botpress.com/docs/adk/quickstart
**GitHub:** https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/cli.md

---

## Linking and Deploying Your Bot

**IMPORTANT:** Your bot must be linked to Botpress Cloud and deployed for it to work. The ADK runs locally during development but the bot itself lives in Botpress Cloud.

### The Correct Order: Link → Dev → Deploy

Follow this order to get your bot working:

```bash
# 1. LINK - Connect your project to Botpress Cloud (creates agent.json)
adk link

# 2. DEV - Start the development server (hot reload, testing)
adk dev

# 3. DEPLOY - Push to production when ready
adk deploy
```

**Step-by-step:**

1. **`adk link`** - Links your local project to a bot in Botpress Cloud. This creates `agent.json` with your workspace and bot IDs. Run this first before anything else.

2. **`adk dev`** - Starts the local development server with hot reloading. Opens the dev console at http://localhost:3001 where you can configure integrations and test your bot. Use `adk chat` in a separate terminal to test.

3. **`adk deploy`** - Deploys your bot to production. Run this when you're ready for your bot to be live and accessible through production channels (Slack, WhatsApp, webchat, etc.).

### Troubleshooting Errors

**If you encounter errors when running `adk dev` or `adk deploy`:**

1. **Check the logs** - Look at the terminal output or the logs panel in the dev console at http://localhost:3001
2. **Copy the error message** - Select and copy the full error message from the logs
3. **Ask for help** - Paste the error back to the AI assistant and ask it to help fix the issue

Common error scenarios:
- **Integration configuration errors:** Usually means an integration needs to be configured in the UI at localhost:3001
- **Type errors:** Often caused by incorrect imports or schema mismatches
- **Deployment failures:** May indicate missing environment variables or invalid configuration

**Example workflow for fixing errors:**
```
1. Run `adk dev` or `adk deploy`
2. See error in terminal/logs
3. Copy the error message
4. Tell the AI: "I got this error when running adk dev: [paste error]"
5. The AI will help diagnose and fix the issue
```

**Docs:** https://www.botpress.com/docs/adk/quickstart
**GitHub:** https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/cli.md

---

## Project Structure

**Critical rule:** File location determines behavior. Place components in the correct `src/` subdirectory or they won't be discovered.

```
my-bot/
├── agent.config.ts    # Bot configuration: name, models, state schemas, integrations
├── agent.json         # Workspace/bot IDs (auto-generated by adk link/dev, add to .gitignore)
├── package.json       # Node.js dependencies and scripts (dev, build, deploy)
├── tsconfig.json      # TypeScript configuration
├── .env               # API keys and secrets (never commit!)
├── .gitignore         # Should include: agent.json, .env, node_modules/, .botpress/
├── src/
│   ├── conversations/ # Handle incoming messages → use execute() for AI responses
│   ├── workflows/     # Background processes → use step() for resumable operations
│   ├── actions/       # Reusable functions → call from anywhere with actions.name()
│   ├── tools/         # AI-callable functions → AI decides when to invoke these
│   ├── tables/        # Data storage → auto-synced to cloud, supports semantic search
│   ├── triggers/      # Event handlers → react to user.created, integration events, etc.
│   └── knowledge/     # RAG sources → index docs, websites, or tables for AI context
└── .botpress/         # Auto-generated types (never edit manually)
```

**Key Configuration Files:**

- **agent.config.ts** - Primary configuration defining bot metadata, AI models, state schemas, and integrations (you edit this)
- **agent.json** - Links agent to workspace/bot IDs. Auto-generated by `adk link` or `adk dev`. **Add to .gitignore** - contains environment-specific IDs that differ per developer
- **package.json** - Node.js config with `@botpress/runtime` dependency and scripts for `dev`, `build`, `deploy`
- **tsconfig.json** - TypeScript configuration for the project
- **.env** - Environment variables for API keys and secrets (never commit!)
- **.gitignore** - Should include: `agent.json`, `.env`, `node_modules/`, `.botpress/`

**Docs:** https://www.botpress.com/docs/adk/project-structure
**GitHub:** https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/agent-config.md

---

## Agent Configuration

The `agent.config.ts` file defines your bot's identity, AI models, state schemas, and integrations. Always start here when setting up a new bot.

```typescript
import { defineConfig, z } from "@botpress/runtime";

export default defineConfig({
  name: "my-support-bot",
  description: "AI customer support assistant",

  // AI models for different operations
  defaultModels: {
    autonomous: "openai:gpt-4o",      // Used by execute() for conversations
    zai: "openai:gpt-4o-mini"         // Used by zai operations (cheaper, faster)
  },

  // Global bot state - shared across all conversations and users
  bot: {
    state: z.object({
      maintenanceMode: z.boolean().default(false),
      totalConversations: z.number().default(0)
    })
  },

  // Per-user state - persists across all conversations for each user
  user: {
    state: z.object({
      name: z.string().optional(),
      tier: z.enum(["free", "pro"]).default("free"),
      preferredLanguage: z.enum(["en", "es", "fr"]).default("en")
    }),
    tags: {
      source: z.string(),
      region: z.string().optional()
    }
  },

  // Per-conversation state
  conversation: {
    state: z.object({
      context: z.string().optional()
    }),
    tags: {
      category: z.enum(["support", "sales", "general"]),
      priority: z.enum(["low", "medium", "high"]).optional()
    }
  },

  // Integrations your bot uses (ADK 1.9+ format)
  dependencies: {
    integrations: {
      chat: { version: "chat@0.7.3", enabled: true },
      slack: { version: "slack@2.5.5", enabled: true }
    }
  }
});
```

**Available models:**
- OpenAI: `openai:gpt-4o`, `openai:gpt-4o-mini`, `openai:gpt-4-turbo`
- Anthropic: `anthropic:claude-3-5-sonnet`, `anthropic:claude-3-opus`
- Google: `google:gemini-1.5-pro`, `google:gemini-1.5-flash`

**Docs:** https://www.botpress.com/docs/adk/project-structure
**GitHub:** https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/agent-config.md

---

## Core Concepts

### 1. Actions - Reusable Business Logic

**When to create an Action:**
- You need reusable logic that will be called from multiple places (workflows, conversations, triggers)
- You're wrapping an external API or database operation
- You want testable, composable business logic
- You need to call integration APIs (Slack, Linear, etc.) with custom logic

**When NOT to use an Action (use a Tool instead):**
- You want the AI to decide when to call it autonomously
- The function should be available during `execute()`

Actions are **not** directly callable by the AI - convert them to tools with `.asTool()` if the AI needs to use them.

**Location:** `src/actions/*.ts`

```typescript
import { Action, z } from "@botpress/runtime";

export const fetchUser = new Action({
  name: "fetchUser",
  description: "Retrieves user details from the database",

  // Define input/output with Zod schemas for type safety
  input: z.object({ userId: z.string() }),
  output: z.object({ name: z.string(), email: z.string() }),

  // IMPORTANT: Handler receives { input, client } - destructure input INSIDE the handler
  async handler({ input, client }) {
    const { user } = await client.getUser({ id: input.userId });
    return { name: user.name, email: user.tags.email };
  }
});
```

**Calling actions:**
```typescript
import { actions } from "@botpress/runtime";
const userData = await actions.fetchUser({ userId: "123" });

// To make an action callable by the AI, convert it to a tool:
tools: [actions.fetchUser.asTool()]
```

**Key Rules:**
- Handler receives `{ input, client }` - must destructure `input` inside the handler
- Cannot destructure input fields directly in parameters
- Can call other actions, integration actions, access state
- Can be converted to tools with `.asTool()`

**Docs:** https://www.botpress.com/docs/adk/concepts/actions
**GitHub:** https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/actions.md

---

### 2. Tools - AI-Callable Functions

**When to create a Tool:**
- You want the AI to autonomously decide when to use this function
- The function retrieves information the AI needs (search, lookup, fetch)
- The function performs actions on behalf of the user (create ticket, send message)
- You're building capabilities the AI should have during conversations

**The AI decides when to use tools based on:**
1. The tool's `description` - Make this clear and specific about WHEN to use it
2. The input schema's `.describe()` fields - Help AI understand what parameters mean
3. The conversation context and user's intent

**Key difference from Actions:** Tools can destructure input directly; Actions cannot.

**Location:** `src/tools/*.ts`

```typescript
import { Autonomous, z } from "@botpress/runtime";

export const searchProducts = new Autonomous.Tool({
  name: "searchProducts",
  // This description is critical - it tells the AI when to use this tool
  description: "Search the product catalog. Use when user asks about products, availability, pricing, or wants to browse items.",

  input: z.object({
    query: z.string().describe("Search keywords"),
    category: z.string().optional().describe("Filter by category")
  }),
  output: z.object({
    products: z.array(z.object({ id: z.string(), name: z.string(), price: z.number() }))
  }),

  // Unlike actions, tools CAN destructure input directly in the handler
  handler: async ({ query, category }) => {
    // Your search logic here
    return { products: [] };
  }
});
```

**Using ThinkSignal:** When a tool can't complete but you want to give the AI context:
```typescript
import { Autonomous } from "@botpress/runtime";

// Inside handler - AI will see this message and can respond appropriately
throw new Autonomous.ThinkSignal(
  "No results found",
  "No products found matching that query. Ask user to try different search terms."
);
```

**Advanced Tool Properties:**
```typescript
export const myTool = new Autonomous.Tool({
  name: "myTool",
  description: "Tool description",
  input: z.object({...}),
  output: z.object({...}),
  aliases: ["searchDocs", "findDocs"],  // Alternative names
  handler: async (input, ctx) => {
    console.log(`Call ID: ${ctx.callId}`);  // Unique call identifier
    // ...
  },
  retry: async ({ attempt, error }) => {
    if (attempt < 3 && error?.code === 'RATE_LIMIT') {
      await new Promise(r => setTimeout(r, 1000 * attempt));
      return true;  // Retry
    }
    return false;  // Don't retry
  }
});
```

**Docs:** https://www.botpress.com/docs/adk/concepts/tools
**GitHub:** https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/tools.md

---

### 3. Conversations - Message Handlers

**When to create a Conversation:**
- Every bot needs at least one conversation handler to respond to users
- Create separate handlers for different channels if they need different behavior
- Use `channel: "*"` to handle all channels with one handler

**Key decisions when building a conversation:**
1. **Which channels?** - Specify `"*"` for all, or specific channels like `"slack.dm"`
2. **What tools does the AI need?** - Pass them to `execute({ tools: [...] })`
3. **What knowledge should ground responses?** - Pass to `execute({ knowledge: [...] })`
4. **What instructions guide the AI?** - Define personality, rules, and context

**The `execute()` function is the heart of ADK** - it runs autonomous AI logic with your tools and knowledge. Most conversation handlers will call `execute()`.

**Location:** `src/conversations/*.ts`

```typescript
import { Conversation, z } from "@botpress/runtime";

export const Chat = new Conversation({
  // Which channels this handler responds to
  channel: "chat.channel",  // Or "*" for all, or ["slack.dm", "webchat.channel"]

  // Per-conversation state (optional)
  state: z.object({
    messageCount: z.number().default(0)
  }),

  async handler({ message, state, conversation, execute, user }) {
    state.messageCount += 1;

    // Handle commands
    if (message?.payload?.text?.startsWith("/help")) {
      await conversation.send({
        type: "text",
        payload: { text: "Available commands: /help, /status" }
      });
      return;
    }

    // Let the AI handle the response with your tools and knowledge
    await execute({
      // Instructions guide the AI's behavior and personality
      instructions: `You are a helpful customer support agent for Acme Corp.
        User's name: ${user.state.name || "there"}
        User's tier: ${user.state.tier}
        Be friendly, concise, and always offer to help further.`,

      // Tools the AI can use during this conversation
      tools: [searchProducts, actions.createTicket.asTool()],

      // Knowledge bases for RAG - AI will search these to ground responses
      knowledge: [DocsKnowledgeBase],

      model: "openai:gpt-4o",
      temperature: 0.7,
      iterations: 10  // Max tool call iterations
    });
  }
});
```

**Handler Context:**
- `message` - User's message data
- `execute` - Run autonomous AI logic
- `conversation` - Conversation instance methods (send, startTyping, stopTyping)
- `state` - Mutable state (bot, user, conversation)
- `client` - Botpress API client
- `type` - Event classification (message, workflow_request)

**Execute Function Options:**
```typescript
await execute({
  instructions: string | async function,  // Required
  tools: Tool[],                          // AI-callable tools
  knowledge: Knowledge[],                 // Knowledge bases for RAG
  exits: Exit[],                          // Structured exit handlers
  model: string,                          // AI model to use
  temperature: number,                    // 0-1, default 0.7
  iterations: number,                     // Max tool calls, default 10
  hooks: {
    onBeforeTool: async ({ tool, input }) => { ... },
    onAfterTool: async ({ tool, output }) => { ... },
    onTrace: async (trace) => { ... }
  }
});
```

**Common channels:** `chat.channel`, `webchat.channel`, `slack.dm`, `slack.channel`, `discord.channel`, `whatsapp.channel`, `"*"` (all)

**Docs:** https://www.botpress.com/docs/adk/concepts/conversations
**GitHub:** https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/conversations.md

---

### 4. Workflows - Background & Multi-Step Processes

**When to create a Workflow:**
- Operations that take longer than 2 minutes (the default timeout)
- Multi-step processes that need to survive crashes/restarts
- Scheduled/recurring tasks (daily reports, periodic syncs)
- Background processing (order fulfillment, data migration)
- Operations that need to wait for external events or user input

**When NOT to use a Workflow (handle in conversation instead):**
- Quick operations that complete immediately
- Simple request-response patterns
- Operations that don't need persistence

**Key workflow concepts:**
- **Steps are checkpoints** - If workflow crashes, it resumes from last completed step
- **State persists** - Store progress in `state` to track across steps
- **Always pass conversationId** - If the workflow needs to message users back

**Location:** `src/workflows/*.ts`

```typescript
import { Workflow, z } from "@botpress/runtime";

export const ProcessOrderWorkflow = new Workflow({
  name: "processOrder",
  description: "Processes customer orders",
  timeout: "6h",                    // Max duration
  schedule: "0 9 * * *",            // Optional: run daily at 9am (cron syntax)

  input: z.object({
    orderId: z.string(),
    conversationId: z.string()      // Include this to message the user back!
  }),

  state: z.object({
    currentStep: z.number().default(0),
    processedItems: z.array(z.string()).default([])
  }),

  output: z.object({
    success: z.boolean(),
    itemsProcessed: z.number()
  }),

  async handler({ input, state, step, client, execute }) {
    // State is passed as parameter, auto-tracked
    state.currentStep = 1;

    // IMPORTANT: Each step needs a unique, stable name (no dynamic names!)
    const orderData = await step("fetch-order", async () => {
      return await fetchOrderData(input.orderId);
    });

    // Steps can have retry logic
    await step("process-payment", async () => {
      return await processPayment(orderData);
    }, { maxAttempts: 3 });

    // To message the user from a workflow, use client.createMessage (NOT conversation.send)
    await step("notify-user", async () => {
      await client.createMessage({
        conversationId: input.conversationId,
        type: "text",
        payload: { text: "Your order has been processed!" }
      });
    });

    return {
      success: true,
      itemsProcessed: state.processedItems.length
    };
  }
});

// Start a workflow from a conversation or trigger
await ProcessOrderWorkflow.start({
  orderId: "123",
  conversationId: conversation.id  // Always pass this if you need to message back
});

// Get or create with deduplication
const instance = await ProcessOrderWorkflow.getOrCreate({
  key: `order-${orderId}`,  // Prevents duplicate workflows
  input: { orderId, conversationId }
});
```

**Step Methods:**

| Method | Purpose |
|--------|---------|
| `step(name, fn)` | Basic execution with caching |
| `step.sleep(name, ms)` | Pause for milliseconds |
| `step.sleepUntil(name, date)` | Pause until specific date |
| `step.listen()` | Wait for external events |
| `step.progress(msg)` | Update progress message |
| `step.request(name, prompt)` | Request user input (blocking) |
| `step.executeWorkflow()` | Start and await another workflow |
| `step.waitForWorkflow(id)` | Wait for existing workflow |
| `step.map(items, fn)` | Process array with concurrency |
| `step.forEach(items, fn)` | Execute on items without results |
| `step.batch(items, fn)` | Process in groups |
| `step.fail(reason)` | Mark workflow as failed |
| `step.abort()` | Stop immediately without failure |

**Critical Rules:**
- Step names must be **unique** and **stable** (avoid dynamic naming in loops)
- State is passed as a parameter, not accessed via `this.state`
- Always pass `conversationId` for workflows that need to message users
- Default timeout is 2 minutes - use steps for longer processes

**Docs:** https://www.botpress.com/docs/adk/concepts/workflows/overview
**GitHub:** https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/workflows.md

---

### 5. Tables - Data Storage

**When to create a Table:**
- You need to persist structured data (users, orders, tickets, logs)
- You want to query/filter data by fields
- You need semantic search on text content (set `searchable: true`)
- You're storing data that should survive bot restarts

**When NOT to use a Table (use State instead):**
- Simple key-value data per user/conversation → use `user.state` or `conversation.state`
- Temporary data that doesn't need persistence
- Small amounts of data that fit in state

**Tables vs Knowledge Bases:**
- **Tables** = Structured data you CRUD (create, read, update, delete)
- **Knowledge Bases** = Documents/content for AI to search and reference

**Location:** `src/tables/*.ts`

**CRITICAL RULES (violations will cause errors):**
- Do NOT define an `id` column - it's created automatically as a number
- Table names MUST end with "Table" (e.g., `OrdersTable`, not `Orders`)

```typescript
import { Table, z } from "@botpress/runtime";

export const OrdersTable = new Table({
  name: "OrdersTable",  // Must end with "Table"
  description: "Stores order information",
  columns: {
    // NO id column - it's automatic!
    orderId: z.string(),
    userId: z.string(),
    status: z.enum(["pending", "completed", "cancelled"]),
    total: z.number(),
    createdAt: z.date(),
    // Enable semantic search on a column:
    notes: {
      schema: z.string(),
      searchable: true
    }
  }
});
```

**CRUD operations:**
```typescript
// Create - id is auto-assigned
await OrdersTable.createRows({
  rows: [{ orderId: "ord-123", userId: "user-456", status: "pending", total: 99.99, createdAt: new Date() }]
});

// Read with filters
const { rows } = await OrdersTable.findRows({
  filter: { userId: "user-456", status: "pending" },
  orderBy: "createdAt",
  orderDirection: "desc",
  limit: 10
});

// Get single row by id
const row = await OrdersTable.getRow({ id: 123 });

// Semantic search (on searchable columns)
const { rows } = await OrdersTable.findRows({
  search: "delivery issue",
  limit: 5
});

// Update - must include the id
await OrdersTable.updateRows({
  rows: [{ id: 1, status: "completed" }]
});

// Upsert - insert or update based on key column
await OrdersTable.upsertRows({
  rows: [{ orderId: "ord-123", status: "shipped" }],
  keyColumn: "orderId"
});

// Delete by filter
await OrdersTable.deleteRows({ status: "cancelled" });

// Delete by IDs
await OrdersTable.deleteRowIds([123, 456]);
```

**Advanced: Computed Columns:**
```typescript
columns: {
  basePrice: z.number(),
  taxRate: z.number(),
  fullPrice: {
    computed: true,
    schema: z.number(),
    dependencies: ["basePrice", "taxRate"],
    value: async (row) => row.basePrice * (1 + row.taxRate)
  }
}
```

**Docs:** https://www.botpress.com/docs/adk/concepts/tables
**GitHub:** https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/tables.md

---

### 6. Knowledge Bases - RAG for AI Context

**When to create a Knowledge Base:**
- You want the AI to answer questions based on your documentation
- You have FAQs, policies, or product info the AI should reference
- You want AI responses grounded in specific content (not hallucinated)
- You're building a support bot that needs access to help articles

**How RAG works in ADK:**
1. You define knowledge sources (websites, files, tables)
2. Content is indexed and embedded for semantic search
3. During `execute()`, the AI automatically searches relevant knowledge
4. AI uses retrieved content to generate grounded responses

**Choosing a DataSource type:**
- **Website** - Index public documentation, help sites, blogs
- **Directory** - Index local markdown/text files (dev only!)
- **Table** - Index structured data from your tables

**Location:** `src/knowledge/*.ts`

```typescript
import { Knowledge, DataSource } from "@botpress/runtime";

// Website source - index via sitemap
const websiteSource = DataSource.Website.fromSitemap(
  "https://docs.example.com/sitemap.xml",
  {
    id: "website-docs",
    maxPages: 500,
    maxDepth: 10,
    filter: (ctx) => ctx.url.includes("/docs/")  // Only index /docs/ pages
  }
);

// Local files (development only - won't work in production)
const localSource = DataSource.Directory.fromPath("src/knowledge/docs", {
  id: "local-docs",
  filter: (path) => path.endsWith(".md")
});

// Table-based knowledge
const tableSource = DataSource.Table.fromTable(FAQTable, {
  id: "faq-table",
  transform: ({ row }) => `Question: ${row.question}\nAnswer: ${row.answer}`,
  filter: ({ row }) => row.published === true
});

export const DocsKB = new Knowledge({
  name: "docsKB",
  description: "Product documentation and help articles",
  sources: [websiteSource, localSource, tableSource]
});

// Use in conversations - AI will search this knowledge base
await execute({
  instructions: "Answer based on the documentation",
  knowledge: [DocsKB]
});

// Manually refresh knowledge base
await DocsKB.refresh();                  // Smart refresh (only changed content)
await DocsKB.refresh({ force: true });   // Force full re-index
await DocsKB.refreshSource("website-docs", { force: true });  // Refresh specific source
```

**Website Source Methods:**
- `fromSitemap(url, options)` - Parse XML sitemap
- `fromWebsite(baseUrl, options)` - Crawl from base URL (requires Browser integration)
- `fromLlmsTxt(url, options)` - Parse llms.txt file
- `fromUrls(urls, options)` - Index specific URLs

**Docs:** https://www.botpress.com/docs/adk/concepts/knowledge
**GitHub:** https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/knowledge-bases.md

---

### 7. Triggers - Event-Driven Automation

**When to create a Trigger:**
- You need to react to events automatically (user signs up, issue created, etc.)
- You want to start workflows when specific events occur
- You need to sync data when external systems change
- You want to send notifications based on events

**Common trigger patterns:**
- **User onboarding** - Trigger on `user.created` → start onboarding workflow
- **Integration sync** - Trigger on `linear:issueCreated` → create record in table
- **Notifications** - Trigger on `workflow.completed` → send Slack message

**Finding available events:**
- Bot events: `user.created`, `conversation.started`, `workflow.completed`, etc.
- Integration events: Run `adk info <integration> --events` to see available events

**Location:** `src/triggers/*.ts`

```typescript
import { Trigger } from "@botpress/runtime";

export default new Trigger({
  name: "onNewUser",
  description: "Start onboarding when user created",
  events: ["user.created"],  // Can listen to multiple events

  handler: async ({ event, client, actions }) => {
    const { userId, email } = event.payload;

    // Start an onboarding workflow
    await OnboardingWorkflow.start({
      userId,
      email
    });
  }
});

// Integration events use format: integration:eventName
export const LinearTrigger = new Trigger({
  name: "onLinearIssue",
  description: "Handle Linear issue events",
  events: ["linear:issueCreated", "linear:issueUpdated"],

  handler: async ({ event, actions }) => {
    if (event.type === "linear:issueCreated") {
      await actions.slack.sendMessage({
        channel: "#notifications",
        text: `New issue: ${event.payload.title}`
      });
    }
  }
});
```

**Common Bot Events:**
- `user.created`, `user.updated`, `user.deleted`
- `conversation.started`, `conversation.ended`, `message.created`
- `workflow.started`, `workflow.completed`, `workflow.failed`
- `bot.started`, `bot.stopped`

**Common Integration Events:**
- Slack: `slack:reactionAdded`, `slack:memberJoinedChannel`
- Linear: `linear:issueCreated`, `linear:issueUpdated`
- GitHub: `github:issueOpened`, `github:pullRequestOpened`
- Intercom: `intercom:conversationEvent`, `intercom:contactEvent`

**Find integration events:** Run `adk info <integration> --events`

**Docs:** https://www.botpress.com/docs/adk/concepts/triggers
**GitHub:** https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/triggers.md

---

## Sending Messages

**CRITICAL: The method depends on WHERE you're sending from:**

| Context | Method | Why |
|---------|--------|-----|
| In Conversations | `conversation.send()` | Has conversation context |
| In Workflows/Actions | `client.createMessage()` | Needs explicit `conversationId` |

**Common mistake:** Using `client.createMessage()` in conversations. Always use `conversation.send()` instead.

The method depends on where you're sending from:

**In conversations** - Use `conversation.send()`:
```typescript
await conversation.send({ type: "text", payload: { text: "Hello!" } });
await conversation.send({ type: "image", payload: { imageUrl: "https://..." } });
await conversation.send({
  type: "choice",
  payload: {
    text: "Pick one:",
    choices: [
      { title: "Option A", value: "a" },
      { title: "Option B", value: "b" }
    ]
  }
});
```

**In workflows or actions** - Use `client.createMessage()` with `conversationId`:
```typescript
await client.createMessage({
  conversationId: input.conversationId,  // Must have this!
  type: "text",
  payload: { text: "Workflow complete!" }
});
```

**All Message Types:**
```typescript
// Text
{ type: "text", payload: { text: "Hello!" } }

// Markdown
{ type: "markdown", payload: { text: "# Heading\n**Bold**" } }

// Image
{ type: "image", payload: { imageUrl: "https://..." } }

// Audio
{ type: "audio", payload: { audioUrl: "https://..." } }

// Video
{ type: "video", payload: { videoUrl: "https://..." } }

// File
{ type: "file", payload: { fileUrl: "https://...", title: "Document.pdf" } }

// Location
{ type: "location", payload: { latitude: 40.7128, longitude: -74.0060, address: "New York, NY" } }

// Card
{ type: "card", payload: {
  title: "Product Name",
  subtitle: "Description",
  imageUrl: "https://...",
  actions: [
    { action: "url", label: "View", value: "https://..." },
    { action: "postback", label: "Buy", value: "buy_123" }
  ]
}}

// Carousel
{ type: "carousel", payload: {
  items: [
    { title: "Item 1", subtitle: "...", imageUrl: "...", actions: [...] },
    { title: "Item 2", subtitle: "...", imageUrl: "...", actions: [...] }
  ]
}}

// Choice (Quick Replies)
{ type: "choice", payload: {
  text: "Select an option:",
  choices: [
    { title: "Option 1", value: "opt1" },
    { title: "Option 2", value: "opt2" }
  ]
}}

// Dropdown
{ type: "dropdown", payload: {
  text: "Select country:",
  options: [
    { label: "United States", value: "us" },
    { label: "Canada", value: "ca" }
  ]
}}
```

**GitHub:** https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/messages.md

---

## Zai - LLM Utility Operations

**When to use Zai vs execute():**
- **Use `zai`** for specific, structured AI operations (extract data, classify, summarize)
- **Use `execute()`** for autonomous, multi-turn AI conversations with tools

**Zai is perfect for:**
- Extracting structured data from user messages (`zai.extract`)
- Classifying/labeling content (`zai.check`, `zai.label`)
- Summarizing long content (`zai.summarize`)
- Answering questions from documents (`zai.answer`)
- Sorting/filtering/grouping data intelligently (`zai.sort`, `zai.filter`, `zai.group`)

**Zai operations are optimized for speed and cost** - they use the `zai` model configured in `agent.config.ts` (typically a faster/cheaper model).

```typescript
import { adk, z } from "@botpress/runtime";

// Extract structured data from text
const contact = await adk.zai.extract(
  "Contact John at john@example.com, phone 555-0100",
  z.object({
    name: z.string(),
    email: z.string(),
    phone: z.string()
  })
);
// Returns: { name: "John", email: "john@example.com", phone: "555-0100" }

// Check if text matches a condition (returns boolean)
const isSpam = await adk.zai.check(messageText, "is spam or promotional");

// Label text with multiple criteria
const labels = await adk.zai.label(customerEmail, {
  spam: "is spam",
  urgent: "needs immediate response",
  complaint: "expresses dissatisfaction"
});
// Returns: { spam: false, urgent: true, complaint: true }

// Summarize content
const summary = await adk.zai.summarize(longDocument, {
  length: 200,
  bulletPoints: true
});

// Answer questions from documents (with citations)
const result = await adk.zai.answer(docs, "What is the refund policy?");
if (result.type === "answer") {
  console.log(result.answer);
  console.log(result.citations);
}
// Response types: "answer", "ambiguous", "out_of_topic", "invalid_question", "missing_knowledge"

// Rate items on 1-5 scale
const scores = await adk.zai.rate(products, "quality score");

// Sort by criteria
const sorted = await adk.zai.sort(tickets, "by urgency, most urgent first");

// Group items semantically
const groups = await adk.zai.group(emails, {
  instructions: "categorize by topic"
});

// Rewrite text
const professional = await adk.zai.rewrite("hey wassup", "make it professional and friendly");

// Filter arrays
const activeUsers = await adk.zai.filter(users, "have been active this month");

// Generate text
const blogPost = await adk.zai.text("Write about AI in healthcare", {
  length: 1000,
  temperature: 0.7
});

// Patch code files
const patched = await adk.zai.patch(files, "add JSDoc comments to all functions");
```

**Zai Configuration:**
```typescript
// Create configured instance
const preciseZai = adk.zai.with({
  modelId: "best",        // "best" | "fast" | custom model ID
  temperature: 0.1
});

// Enable active learning
const learningZai = adk.zai.learn("sentiment-analysis");
```

**Docs:** https://www.botpress.com/docs/adk/zai/overview
**GitHub:** https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/zai-complete-guide.md

---

## Integrations

**When to add an Integration:**
- You need to connect to an external service (Slack, Linear, GitHub, etc.)
- You want to receive messages from a channel (webchat, WhatsApp, Discord)
- You need to call external APIs with pre-built actions
- You want to react to events from external systems

**Integration workflow:**
1. **Search** - Find integrations with `adk search <name>`
2. **Add** - Install with `adk add <name>@<version>`
3. **Configure** - Set up credentials in the UI at `http://localhost:3001/`
4. **Use** - Call actions via `actions.<integration>.<action>()`

**Making integration actions available to AI:**
```typescript
// Convert any integration action to an AI-callable tool
tools: [actions.slack.sendMessage.asTool()]
```

**CLI commands:**
```bash
adk search slack           # Find integrations
adk add slack@latest       # Add to project
adk add slack --alias my-slack  # Add with custom alias
adk info slack --events    # See available events
adk list                   # List installed integrations
adk upgrade slack          # Update to latest
adk remove slack           # Remove integration
```

**Using integration actions:**
```typescript
import { actions } from "@botpress/runtime";

// Slack
await actions.slack.sendMessage({ channel: "#general", text: "Hello!" });
await actions.slack.addReaction({ channel: "C123", timestamp: "123", name: "thumbsup" });

// Linear
await actions.linear.issueCreate({ teamId: "123", title: "Bug report", description: "Details" });
const { items } = await actions.linear.issueList({
  first: 10,
  filter: { state: { name: { eq: "In Progress" } } }
});

// GitHub
await actions.github.createIssue({ owner: "org", repo: "repo", title: "Issue" });

// Browser (web scraping)
const results = await actions.browser.webSearch({ query: "Botpress docs", maxResults: 5 });

// Make integration actions available to AI as tools
await execute({ tools: [actions.slack.sendMessage.asTool()] });
```

**Docs:** https://www.botpress.com/docs/adk/managing-integrations
**GitHub:** https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/integration-actions.md

---

## State Management

**Understanding the state hierarchy - choose the right level:**

| State Level | Scope | Use For |
|-------------|-------|---------|
| `bot.state` | Global, all users | Feature flags, counters, maintenance mode |
| `user.state` | Per user, all their conversations | User preferences, profile, tier |
| `conversation.state` | Per conversation | Context, message count, active workflow |
| `workflow.state` | Per workflow instance | Progress tracking, intermediate results |

**State is automatically persisted** - just modify it and it saves.

Access and modify state from anywhere in your bot:

```typescript
import { bot, user, conversation } from "@botpress/runtime";

// Bot state - global, shared across all users
bot.state.maintenanceMode = true;
bot.state.totalConversations += 1;

// User state - per user, persists across conversations
user.state.name = "Alice";
user.state.tier = "pro";
user.state.preferredLanguage = "es";

// In handlers, state is passed as a parameter
async handler({ state }) {
  state.messageCount += 1;  // Auto-persisted
}

// Tags - simple string key-value pairs for categorization
user.tags.source = "website";
user.tags.region = "north-america";
conversation.tags.category = "support";
conversation.tags.priority = "high";
```

**State Types:**
- **Bot State** - Global, shared across all users and conversations
- **User State** - Per-user, persists across all their conversations
- **Conversation State** - Per-conversation, isolated between conversations
- **Workflow State** - Per-workflow instance, persists across steps

**Tags vs State:**
- Use **Tags** for: categorization, simple strings, filtering/querying
- Use **State** for: complex objects, arrays, nested data, business logic

**GitHub:** https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/tags.md

---

## Context API

Access runtime services in any handler:

```typescript
import { context } from "@botpress/runtime";

// Always available
const client = context.get("client");           // Botpress API client
const citations = context.get("citations");     // Citation manager
const cognitive = context.get("cognitive");     // LLM client
const logger = context.get("logger");           // Structured logger
const botId = context.get("botId");            // Current bot ID
const configuration = context.get("configuration");  // Bot config

// Conditionally available (use { optional: true })
const user = context.get("user", { optional: true });
const conversation = context.get("conversation", { optional: true });
const message = context.get("message", { optional: true });
const workflow = context.get("workflow", { optional: true });
const chat = context.get("chat", { optional: true });  // Conversation transcript

if (user) {
  console.log(`User: ${user.id}`);
}
```

**GitHub:** https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/context-api.md

---

## CLI Quick Reference

```bash
# Project Lifecycle
adk init <name>              # Create new project
adk login                    # Authenticate with Botpress
adk dev                      # Start dev server (hot reload)
adk dev --port 3000          # Custom port
adk chat                     # Test in CLI
adk build                    # Build for production
adk deploy                   # Deploy to Botpress Cloud
adk deploy --env production  # Deploy to specific environment

# Integration Management
adk add <integration>        # Add integration
adk add slack@2.5.5          # Add specific version
adk add slack --alias my-slack  # Add with alias
adk remove <integration>     # Remove integration
adk search <query>           # Search integrations
adk list                     # List installed integrations
adk list --available         # List all available
adk info <name>              # Integration details
adk info <name> --events     # Show available events
adk upgrade <name>           # Update integration
adk upgrade                  # Interactive upgrade all

# Knowledge & Assets
adk kb sync --dev            # Sync knowledge bases
adk kb sync --prod --force   # Force re-sync production
adk assets sync              # Sync static files

# Advanced
adk run <script.ts>          # Run TypeScript script
adk mcp                      # Start MCP server
adk link --workspace ws_123 --bot bot_456  # Link to existing bot

# Utilities
adk self-upgrade             # Update CLI
adk telemetry --disable      # Disable telemetry
adk --help                   # Full CLI help
adk <command> --help         # Help for specific command
```

**Docs:** https://www.botpress.com/docs/adk/cli-reference
**GitHub:** https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/cli.md

---

## Autonomous Execution with `execute()`

**The `execute()` function is the core of ADK's AI capabilities.** It runs an autonomous AI agent that can:
- Understand user intent from natural language
- Decide which tools to call and when
- Search knowledge bases for relevant information
- Generate contextual responses
- Loop through multiple tool calls until the task is complete

**When to use execute():**
- In conversation handlers to generate AI responses
- In workflows when you need AI decision-making
- Anywhere you want autonomous, multi-step AI behavior

**Key parameters to configure:**
- `instructions` - Tell the AI who it is and how to behave
- `tools` - Give the AI capabilities (search, create, update, etc.)
- `knowledge` - Ground the AI in your documentation
- `exits` - Define structured output schemas for specific outcomes

The `execute()` function enables autonomous AI agent behavior:

```typescript
import { Autonomous, z } from "@botpress/runtime";

// Define custom tool
const searchTool = new Autonomous.Tool({
  name: "search",
  description: "Search documentation",
  input: z.object({ query: z.string() }),
  output: z.string(),
  handler: async ({ query }) => {
    // Search implementation
    return "results...";
  }
});

// Define exit (structured response)
const AnswerExit = new Autonomous.Exit({
  name: "Answer",
  description: "Provide final answer to the user",
  schema: z.object({
    answer: z.string(),
    confidence: z.number(),
    sources: z.array(z.string())
  })
});

// Execute AI with tools, knowledge, and exits
const result = await execute({
  instructions: "Help the user with their request. Be helpful and concise.",

  // Add tools
  tools: [
    searchTool,
    actions.linear.issueCreate.asTool()
  ],

  // Add knowledge bases
  knowledge: [DocsKnowledgeBase, FAQKnowledgeBase],

  // Define exits for structured outputs
  exits: [AnswerExit],

  // Model configuration
  model: "openai:gpt-4o",
  temperature: 0.7,
  iterations: 10,  // Max tool call iterations

  // Hooks for monitoring
  hooks: {
    onBeforeTool: async ({ tool, input }) => {
      console.log(`Calling ${tool.name}`, input);
      return { input: { ...input, enhanced: true } };  // Modify input
    },
    onAfterTool: async ({ tool, output }) => {
      console.log(`Result:`, output);
    }
  }
});

// Handle structured exit
if (result.is(AnswerExit)) {
  console.log(result.output.answer);
  console.log(result.output.sources);
}
```

---

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| "Cannot destructure property" in Actions | Destructuring input directly in handler params | Use `async handler({ input, client })` then `const { field } = input` inside |
| Table creation fails | Invalid table name or `id` defined | Remove `id` column, ensure name ends with "Table" |
| Integration action not found | Integration not installed or configured | Run `adk list`, add with `adk add`, configure in UI at localhost:3001 |
| Knowledge base not updating | KB not synced | Run `adk kb sync --dev` or `adk kb sync --force` |
| Workflow not resuming | Dynamic step names | Use stable, unique step names (no `step(\`item-${i}\`)`) |
| Types out of date | Generated types stale | Run `adk dev` or `adk build` to regenerate |
| Can't message user from workflow | Missing conversationId | Pass `conversationId` when starting workflow, use `client.createMessage()` |
| "user is not defined" | Accessing conversation context outside conversation | Use `context.get("user", { optional: true })` |
| State changes not persisting | Creating new objects instead of modifying | Modify state directly: `state.user.name = "Alice"` |
| Tool not being used by AI | Poor description | Improve tool description, add detailed `.describe()` to inputs |

**For more help:** Run `adk --help` or check:
- **Docs:** https://www.botpress.com/docs/adk/
- **GitHub:** https://github.com/botpress/skills/tree/master/skills/adk/references

---

## Common Patterns & Best Practices

### 1. Always Pass conversationId for Workflows
```typescript
// In conversation - starting a workflow that needs to message back
await MyWorkflow.start({
  conversationId: conversation.id,  // Always include this!
  data: "..."
});

// In workflow - messaging back to user
await client.createMessage({
  conversationId: input.conversationId,
  type: "text",
  payload: { text: "Processing complete!" }
});
```

### 2. Use Environment Variables for Secrets
```typescript
// In .env (never commit!)
API_KEY=sk-...
SLACK_TOKEN=xoxb-...

// In code
config: { apiKey: process.env.API_KEY }
```

### 3. Keep Step Names Stable in Workflows
```typescript
// GOOD - Single step for batch
await step("process-all-items", async () => {
  for (const item of items) {
    await processItem(item);
  }
});

// BAD - Dynamic names break resume
for (let i = 0; i < items.length; i++) {
  await step(`process-${i}`, async () => { ... });  // Don't do this!
}
```

### 4. Error Handling in Actions/Tools
```typescript
export default new Action({
  handler: async ({ input }) => {
    try {
      // Action logic
      return { success: true };
    } catch (error) {
      console.error("Action failed:", error);
      throw new Error(`Failed to process: ${error.message}`);
    }
  }
});
```

### 5. ThinkSignal for Tool Edge Cases
```typescript
handler: async ({ query }) => {
  const results = await search(query);

  if (!results.length) {
    throw new Autonomous.ThinkSignal(
      "No results",
      "No results found. Ask the user to try different search terms."
    );
  }

  return results;
}
```

### 6. Multi-Channel Handling
```typescript
export default new Conversation({
  channels: ["slack.channel", "webchat.channel"],
  handler: async ({ conversation }) => {
    const channel = conversation.channel;

    if (channel === "slack.channel") {
      // Slack-specific handling (threading, mentions, etc.)
    } else if (channel === "webchat.channel") {
      // Webchat-specific handling
    }
  }
});
```

---

## Complete Reference Documentation

### Official Botpress ADK Documentation
**Base URL:** https://www.botpress.com/docs/adk/

| Topic | URL |
|-------|-----|
| Introduction | https://www.botpress.com/docs/adk/introduction |
| Quickstart | https://www.botpress.com/docs/adk/quickstart |
| Project Structure | https://www.botpress.com/docs/adk/project-structure |
| Actions | https://www.botpress.com/docs/adk/concepts/actions |
| Tools | https://www.botpress.com/docs/adk/concepts/tools |
| Conversations | https://www.botpress.com/docs/adk/concepts/conversations |
| Workflows Overview | https://www.botpress.com/docs/adk/concepts/workflows/overview |
| Workflow Steps | https://www.botpress.com/docs/adk/concepts/workflows/steps |
| Tables | https://www.botpress.com/docs/adk/concepts/tables |
| Triggers | https://www.botpress.com/docs/adk/concepts/triggers |
| Knowledge Bases | https://www.botpress.com/docs/adk/concepts/knowledge |
| Managing Integrations | https://www.botpress.com/docs/adk/managing-integrations |
| Zai Overview | https://www.botpress.com/docs/adk/zai/overview |
| Zai Reference | https://www.botpress.com/docs/adk/zai/reference |
| CLI Reference | https://www.botpress.com/docs/adk/cli-reference |

### GitHub Repository References (AI-Optimized)
**Base URL:** https://github.com/botpress/skills/tree/master/skills/adk/references

For detailed specifications beyond this guide, fetch the corresponding reference file:

| Topic | Reference File |
|-------|----------------|
| Actions | https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/actions.md |
| Tools | https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/tools.md |
| Workflows | https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/workflows.md |
| Conversations | https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/conversations.md |
| Tables | https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/tables.md |
| Triggers | https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/triggers.md |
| Knowledge Bases | https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/knowledge-bases.md |
| Messages | https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/messages.md |
| Agent Config | https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/agent-config.md |
| CLI | https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/cli.md |
| Integration Actions | https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/integration-actions.md |
| Model Configuration | https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/model-configuration.md |
| Context API | https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/context-api.md |
| Tags | https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/tags.md |
| Files | https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/files.md |
| Zai Complete Guide | https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/zai-complete-guide.md |
| Zai Agent Reference | https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/zai-agent-reference.md |
| MCP Server | https://raw.githubusercontent.com/botpress/skills/master/skills/adk/references/mcp-server.md |

---

## Common Scenarios - What to Build

**"I want to build a support bot that answers questions from our docs"**
1. Create a Knowledge Base with your documentation as a source
2. Create a Conversation handler that uses `execute()` with that knowledge
3. Add the `chat` integration for testing

**"I want the bot to create tickets in Linear when users report issues"**
1. Add the Linear integration: `adk add linear`
2. Create a Tool that calls `actions.linear.issueCreate()`
3. Pass the tool to `execute()` in your conversation

**"I need to run a daily sync job"**
1. Create a Workflow with `schedule: "0 9 * * *"` (cron syntax)
2. Implement the sync logic in steps
3. The workflow will run automatically at the scheduled time

**"I want to store user preferences"**
1. Define the schema in `agent.config.ts` under `user.state`
2. Access/modify via `user.state.preferenceField = value`
3. State persists automatically

**"I need to react when a new user signs up"**
1. Create a Trigger listening to `user.created` event
2. In the handler, start an onboarding workflow or send a welcome message

**"I want to store order data and search it"**
1. Create a Table with your schema (remember: no `id` field, name ends with "Table")
2. Use `searchable: true` on text columns you want to search
3. Use CRUD methods: `createRows`, `findRows`, `updateRows`, `deleteRows`

---

## Summary

This skill provides comprehensive guidance for building Botpress bots using the ADK:

- **Setup & Initialization** - ADK installation and project creation
- **Project Structure** - Conventions, files, and organization
- **Core Concepts** - Actions, Tools, Workflows, Conversations, Tables, Knowledge, Triggers
- **State Management** - Bot, user, conversation, and workflow state
- **Integration Management** - Adding and configuring integrations
- **Zai (AI Operations)** - Extract, check, label, summarize, answer, sort, group, rewrite, filter
- **CLI Reference** - Complete command guide
- **Testing & Deployment** - Local testing and cloud deployment
- **Common Patterns** - Best practices and troubleshooting

**Core Principle:** The ADK is a convention-based framework where file location determines behavior. Place components in the correct `src/` subdirectory and they automatically become bot capabilities.

**When to use this skill:**
- User wants to create a new Botpress bot
- User asks how to add actions, tools, workflows, conversations, tables, knowledge bases, or triggers
- User needs help with integrations (Slack, Linear, GitHub, etc.)
- User wants to understand ADK patterns and best practices
- User has errors or needs troubleshooting
- User asks about CLI commands, configuration, or deployment

**Official Documentation:** https://www.botpress.com/docs/adk/
**GitHub Repository:** https://github.com/botpress/adk
**Skills Repository:** https://github.com/botpress/skills
