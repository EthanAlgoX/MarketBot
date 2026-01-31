<ccr_integration>

Claude Code Router (CCR) enables GSD Autopilot to use different AI models for different phases, optimizing for both cost and capability. Instead of using a single model for all phases, you can route simple tasks to inexpensive models and complex reasoning tasks to premium models.

<what_is_ccr>

CCR is a proxy router that sits between Claude Code and multiple AI model providers. It allows you to:
- Route requests to different models based on configuration
- Use multiple providers (Anthropic, OpenAI, Z-AI, OpenRouter) in one workflow
- Set up automatic model selection rules
- Save costs by matching model capability to task complexity

</what_is_ccr>

<installation>

## Install CCR

```bash
# Clone CCR repository
git clone https://github.com/musistudio/claude-code-router.git
cd claude-code-router

# Install dependencies
npm install

# Create global symlink
npm link
```

## Configure CCR

Create `~/.claude-code-router/config.json`:

```json
{
  "APIKEY": "your-primary-api-key",
  "PROXY_URL": "http://127.0.0.1:7890",
  "LOG": true,
  "API_TIMEOUT_MS": 600000,
  "Providers": [
    {
      "name": "anthropic",
      "api_base_url": "https://api.anthropic.com",
      "api_key": "your-anthropic-key",
      "models": ["claude-3-5-sonnet-latest", "claude-3-5-opus-latest"]
    },
    {
      "name": "z-ai",
      "api_base_url": "https://open.bigmodel.cn/api/paas/v4/",
      "api_key": "your-z-ai-key",
      "models": ["glm-4.7"]
    },
    {
      "name": "openrouter",
      "api_base_url": "https://openrouter.ai/api/v1/chat/completions",
      "api_key": "your-openrouter-key",
      "models": ["deepseek/deepseek-reasoner", "google/gemini-2.5-pro-preview"]
    }
  ],
  "Router": {
    "default": "anthropic,claude-3-5-sonnet-latest",
    "background": "z-ai,glm-4.7",
    "think": "openrouter,deepseek/deepseek-reasoner",
    "longContext": "anthropic,claude-3-5-opus-latest"
  }
}
```

## Start CCR Service

```bash
# Start the router service
ccr start

# Verify it's running
curl http://127.0.0.1:3456/health
```

</installation>

<autopilot_integration>

## Automatic Detection

When you run `/gsd:autopilot`, it automatically:
1. Checks if `ccr` command is available
2. Creates `.planning/phase-models.json` from template (first run)
3. Uses CCR for model routing if available
4. Falls back to native `claude` command if CCR not detected

## Phase Model Configuration

Edit `.planning/phase-models.json` to customize per-phase model selection:

```json
{
  "description": "Per-phase model configuration for GSD Autopilot",
  "default_model": "claude-3-5-sonnet-latest",
  "phases": {
    "1": {
      "model": "claude-3-5-sonnet-latest",
      "reasoning": "Initial setup and architecture - Sonnet is cost-effective"
    },
    "2": {
      "model": "claude-3-5-opus-latest",
      "reasoning": "Complex implementation requiring deep reasoning"
    },
    "3": {
      "model": "claude-3-5-sonnet-latest",
      "reasoning": "Standard development work"
    },
    "gaps": {
      "model": "glm-4.7",
      "reasoning": "Gap closure is typically straightforward fixes"
    },
    "continuation": {
      "model": "claude-3-5-sonnet-latest",
      "reasoning": "Checkpoint continuations need context"
    },
    "verification": {
      "model": "glm-4.7",
      "reasoning": "Verification is systematic testing"
    },
    "milestone_complete": {
      "model": "claude-3-5-sonnet-latest",
      "reasoning": "Completion task is straightforward"
    }
  },
  "provider_routing": {
    "claude-3-5-sonnet-latest": {
      "provider": "anthropic",
      "base_url": "https://api.anthropic.com"
    },
    "claude-3-5-opus-latest": {
      "provider": "anthropic",
      "base_url": "https://api.anthropic.com"
    },
    "glm-4.7": {
      "provider": "z-ai",
      "base_url": "https://open.bigmodel.cn/api/paas/v4/",
      "auth_header": "Authorization"
    },
    "deepseek-reasoner": {
      "provider": "openrouter",
      "model_name": "deepseek/deepseek-reasoner",
      "base_url": "https://openrouter.ai/api/v1/chat/completions"
    }
  },
  "cost_optimization": {
    "enabled": true,
    "auto_downgrade_on_budget": {
      "threshold_percent": 80,
      "fallback_model": "claude-3-5-haiku-latest"
    }
  }
}
```

## Running Autopilot with CCR

**Option 1: Direct execution (recommended)**
```bash
cd /path/to/project
bash .planning/autopilot.sh
```
The script automatically detects CCR and uses configured models.

**Option 2: Explicit CCR wrapper**
```bash
cd /path/to/project
ccr code --model claude-3-5-sonnet-latest -- bash .planning/autopilot.sh
```

**Option 3: Background execution**
```bash
cd /path/to/project
nohup bash .planning/autopilot.sh > .planning/logs/autopilot.log 2>&1 &
```

</autopilot_integration>

<model_selection_strategy>

## By Task Type

| Task Type | Recommended Model | Reason |
|-----------|-------------------|---------|
| **Complex Architecture** | `claude-3-5-opus-latest` | Deep reasoning, system design |
| **Implementation** | `claude-3-5-sonnet-latest` | Good balance of capability/cost |
| **Testing & Verification** | `glm-4.7` | Systematic, cost-effective |
| **Documentation** | `glm-4.7` | Straightforward generation |
| **Bug Fixes** | `claude-3-5-sonnet-latest` | Context + problem-solving |
| **Code Review** | `claude-3-5-opus-latest` | Thorough analysis needed |

## By Phase Context

**Phase 1 (Setup/Architecture)**
- Use: `claude-3-5-sonnet-latest`
- Reasoning: Initial work is important but typically follows patterns

**Phase 2 (Core Implementation)**
- Use: `claude-3-5-opus-latest` or `deepseek-reasoner`
- Reasoning: Complex problem-solving, architectural decisions

**Phase 3+ (Development)**
- Use: `claude-3-5-sonnet-latest`
- Reasoning: Consistent quality at moderate cost

**Gap Closure**
- Use: `glm-4.7`
- Reasoning: Usually straightforward fixes based on verification feedback

**Verification**
- Use: `glm-4.7`
- Reasoning: Systematic testing doesn't require deep reasoning

## Cost Optimization Example

For a typical 5-phase project:

```
Phase 1: Sonnet (~$0.50)
Phase 2: Opus (~$1.50)
Phase 3: Sonnet (~$0.50)
Phase 4: Sonnet (~$0.50)
Phase 5: Sonnet (~$0.50)
Gap Closure: GLM (~$0.05)
Verification: GLM (~$0.05)

Total: ~$3.60
```

vs. all Opus (~$7.50)
**Savings: ~52%**

</model_selection_strategy>

<advanced_config>

## Auto-Downgrade on Budget

Enable automatic model downgrading when approaching budget limit:

```json
{
  "cost_optimization": {
    "enabled": true,
    "auto_downgrade_on_budget": {
      "threshold_percent": 80,
      "fallback_model": "claude-3-5-haiku-latest"
    }
  }
}
```

## Task-Type Routing

Automatically route by detected task type:

```json
{
  "task_type_routing": {
    "research": "claude-3-5-sonnet-latest",
    "planning": "claude-3-5-haiku-latest",
    "coding": "claude-3-5-sonnet-latest",
    "verification": "claude-3-5-haiku-latest",
    "testing": "glm-4.7"
  }
}
```

## Provider Failover

Configure automatic failover between providers:

```json
{
  "provider_routing": {
    "claude-3-5-sonnet-latest": [
      {
        "provider": "anthropic",
        "base_url": "https://api.anthropic.com",
        "priority": 1
      },
      {
        "provider": "openrouter",
        "model_name": "anthropic/claude-3-5-sonnet",
        "base_url": "https://openrouter.ai/api/v1/chat/completions",
        "priority": 2
      }
    ]
  }
}
```

</advanced_config>

<monitoring>

## Check CCR Status

```bash
# Verify CCR is running
ccr status

# Test model routing
ccr model claude-3-5-sonnet-latest

# View logs
tail -f ~/.claude-code-router/logs/router.log
```

## Verify Model Configuration

```bash
# Check which model will be used for a phase
grep -A 2 '"phase_number"' .planning/phase-models.json

# List all configured models
cat .planning/phase-models.json | grep '"model":' | sort | uniq
```

## Debug Autopilot Execution

The autopilot logs which model is used for each phase:

```
[2025-01-26 10:15:23] [INFO] Configured CCR for model: claude-3-5-opus-latest via anthropic
[2025-01-26 10:15:24] [INFO] Planning phase 2
[2025-01-26 10:18:45] [INFO] Executing phase 2
```

## Cost Tracking

Each phase log includes token usage and estimated cost:

```
[2025-01-26 10:20:15] [COST] Phase 2: 62,100 tokens (~$1.50)
```

Total cost accumulates across all phases.

</monitoring>

<troubleshooting>

## CCR Not Detected

**Symptom:** "CCR not found, using default claude command"

**Solution:**
1. Verify CCR installation: `which ccr`
2. Start CCR service: `ccr start`
3. Check CCR config: `cat ~/.claude-code-router/config.json`

## Model Not Found

**Symptom:** "Model 'glm-4.7' not available"

**Solution:**
1. Verify model is in CCR config under `Providers[].models`
2. Check API key is valid for the provider
3. Test model directly: `ccr model glm-4.7`

## Routing Failure

**Symptom:** "Provider routing failed"

**Solution:**
1. Check `.planning/phase-models.json` syntax (use JSON validator)
2. Verify `provider_routing` section has the model defined
3. Check CCR service logs for detailed errors

## API Rate Limits

**Symptom:** Requests failing with rate limit errors

**Solution:**
1. Add delays between phase executions in autopilot script
2. Use multiple API keys across different providers
3. Enable provider failover in configuration

</troubleshooting>

<best_practices>

1. **Start Conservative, Optimize Later**
   - Begin with all phases using `claude-3-5-sonnet-latest`
   - Profile actual costs and performance
   - Gradually move suitable phases to cheaper models

2. **Document Model Choices**
   - Always include `reasoning` field explaining model choice
   - Makes it easier to revisit and optimize later
   - Helps team understand trade-offs

3. **Use Budget Tracking**
   - Set `budget_limit_usd` in `.planning/config.json`
   - Enable `auto_downgrade_on_budget`
   - Review cost after each milestone

4. **Test Critical Phases**
   - Complex architecture phases (`--from-phase 2`)
   - Use premium models for unrecoverable operations
   - Don't over-optimize early phases

5. **Keep Fallbacks**
   - Always configure `default_model`
   - Ensure at least one provider works for all models
   - Test CCR configuration before long autopilot runs

6. **Monitor Token Usage**
   - Review logs for unexpected cost spikes
   - Large token usage may indicate context issues
   - Consider splitting overly complex phases

</best_practices>

<example_workflows>

## Budget-Conscious Project

```json
{
  "default_model": "glm-4.7",
  "phases": {
    "1": { "model": "glm-4.7" },
    "2": { "model": "claude-3-5-sonnet-latest" },
    "3": { "model": "glm-4.7" }
  },
  "cost_optimization": {
    "enabled": true,
    "auto_downgrade_on_budget": {
      "threshold_percent": 70,
      "fallback_model": "glm-4.7"
    }
  }
}
```

## Quality-Focused Project

```json
{
  "default_model": "claude-3-5-opus-latest",
  "phases": {
    "1": { "model": "claude-3-5-opus-latest" },
    "2": { "model": "claude-3-5-opus-latest" },
    "3": { "model": "claude-3-5-opus-latest" }
  }
}
```

## Mixed Provider Setup

```json
{
  "provider_routing": {
    "claude-3-5-sonnet-latest": {
      "provider": "openrouter",
      "model_name": "anthropic/claude-3-5-sonnet",
      "base_url": "https://openrouter.ai/api/v1/chat/completions"
    },
    "glm-4.7": {
      "provider": "z-ai",
      "base_url": "https://open.bigmodel.cn/api/paas/v4/"
    }
  }
}
```

</example_workflows>

<summary>

CCR integration with GSD Autopilot provides:
- ✅ **Cost Optimization**: Route simple tasks to cheap models
- ✅ **Capability Matching**: Use premium models only where needed
- ✅ **Provider Flexibility**: Mix Anthropic, OpenAI, Z-AI, OpenRouter
- ✅ **Automatic Fallback**: Works without CCR if not configured
- ✅ **Transparent**: Model selection logged for debugging

Start with the template configuration, test on a small project, then optimize for your specific needs!

</summary>

</ccr_integration>
