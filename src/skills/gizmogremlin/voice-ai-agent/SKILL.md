---
name: voice-ai-agents
description: >
  Create, manage, and deploy Voice.ai conversational AI agents.
  Use when the user wants to work with voice agents, list their agents, create new ones, or manage agent configurations.
---

# Voice.ai Agents

Build conversational AI voice agents with Voice.ai's Agent API.

## ✨ Features

- **Agent Management** - Create, update, and delete voice agents
- **One-Click Deploy** - Deploy agents for phone calls instantly
- **Knowledge Base** - RAG-powered agents with custom knowledge
- **MCP Integration** - Connect agents to external tools via MCP
- **Phone Numbers** - Manage inbound/outbound phone numbers
- **Analytics** - Track call history and agent performance

## 🚀 Quick Start

```bash
export VOICE_AI_API_KEY="your-api-key"

# Create an agent
node scripts/agent.js create --name "Support Bot" --prompt "You are a helpful assistant"

# List all agents
node scripts/agent.js list

# Deploy an agent
node scripts/agent.js deploy --id <agent_id>
```

## 🤖 Agent Configuration

| Parameter              | Default | Description                          |
|------------------------|---------|--------------------------------------|
| llm_model              | gemini-2.5-flash-lite | LLM model for responses |
| llm_temperature        | 0.7     | Response creativity (0-2)            |
| max_call_duration      | 900     | Max call length in seconds           |
| allow_interruptions    | true    | Let users interrupt agent            |
| auto_noise_reduction   | true    | Filter background noise              |

## 🎙️ TTS Voice Settings

| Parameter   | Default | Description                    |
|-------------|---------|--------------------------------|
| voice_id    | -       | Voice ID for agent speech      |
| model       | auto    | TTS model (auto-selected)      |
| language    | en      | Language code                  |
| temperature | 1.0     | Voice expressiveness (0-2)     |
| top_p       | 0.8     | Sampling parameter (0-1)       |

## 🌍 Supported Languages

`auto`, `en`, `ca`, `sv`, `es`, `fr`, `de`, `it`, `pt`, `pl`, `ru`, `nl`

## 💻 CLI Usage

```bash
# Create a new agent
node scripts/agent.js create --name "My Agent" --prompt "System prompt here" --greeting "Hello!"

# List all agents
node scripts/agent.js list

# Get agent details
node scripts/agent.js get --id <agent_id>

# Update an agent
node scripts/agent.js update --id <agent_id> --prompt "New prompt"

# Deploy an agent
node scripts/agent.js deploy --id <agent_id>

# Pause an agent
node scripts/agent.js pause --id <agent_id>

# Delete an agent
node scripts/agent.js delete --id <agent_id>
```

## 🔗 MCP Server Integration

Connect your agent to external tools:

```javascript
const agent = await client.createAgent({
  name: "MCP Agent",
  config: {
    prompt: "You can use tools to help users",
    mcp_servers: [{
      name: "my-tools",
      url: "https://my-server.com/mcp",
      auth_type: "bearer_token",
      auth_token: "secret"
    }]
  }
});
```

## 📚 Knowledge Base (RAG)

Add custom knowledge to your agent:

```bash
# Create agent with knowledge base
node scripts/agent.js create --name "FAQ Bot" --kb-id 123
```

## 🔗 Links

- [Voice Agents Guide](https://voice.ai/docs/guides/voice-agents/quickstart)
- [Agent API Reference](https://voice.ai/docs/api-reference/agent-management/create-agent)


---

Made with ❤️ by [Nick Gill](https://github.com/gizmoGremlin)
