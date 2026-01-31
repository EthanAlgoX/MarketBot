---
name: beautiful-mermaid
description: |
  Render beautiful Mermaid diagrams as SVGs or ASCII art. Use when user sends Mermaid code blocks 
  (\`\`\`mermaid ... \`\`\`) and wants to visualize them. Supports: Flowcharts, State, Sequence, Class, ER diagrams.
  Features: Ultra-fast (100+ diagrams <500ms), zero DOM dependencies, 15 built-in themes, Shiki theme compatibility.
  Perfect for: Telegram messages, terminal output, web interfaces, CLI tools.
---

# Beautiful Mermaid

Render Mermaid diagrams as beautiful SVGs or ASCII art. Ultra-fast, fully themeable, zero DOM dependencies. Built for the AI era.

## When to Use

Use this skill when:
- User sends Mermaid code blocks (\`\`\`mermaid ... \`\`\`)
- User asks to "render" or "visualize" a diagram
- User wants terminal/ASCII output for diagrams
- User needs themed diagrams (15 built-in themes)
- User wants SVG output for rich UIs

## Installation

```bash
npm install beautiful-mermaid
# or
bun add beautiful-mermaid
# or
pnpm add beautiful-mermaid
```

## Quick Start

### SVG Output (Default)

```typescript
import { renderMermaid } from 'beautiful-mermaid'

const svg = await renderMermaid(`
  graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action]
    B -->|No| D[End]
`)
```

### ASCII Output (Terminal)

```typescript
import { renderMermaidAscii } from 'beautiful-mermaid'

const ascii = renderMermaidAscii(`graph LR; A --> B --> C`)
```

**Output:**
```
┌───┐     ┌───┐     ┌───┐
│   │     │   │     │   │
│ A │────►│ B │────►│ C │
│   │     │   │     │   │
└───┘     └───┘     └───┘
```

## Supported Diagrams

| Type | Syntax | Description |
|------|--------|-------------|
| Flowchart | `graph TD/LR/BT/RL` | All directions supported |
| State | `stateDiagram-v2` | State machine diagrams |
| Sequence | `sequenceDiagram` | Sequence/interaction diagrams |
| Class | `classDiagram` | Class inheritance diagrams |
| ER | `erDiagram` | Entity-relationship diagrams |

### Flowchart Example

\`\`\`mermaid
graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Action]
  B -->|No| D[End]
  C --> D
\`\`\`

### Sequence Example

\`\`\`mermaid
sequenceDiagram
  Alice->>Bob: Hello Bob!
  Bob-->>Alice: Hi Alice!
\`\`\`

## Theming System

### Built-in Themes (15)

```typescript
import { renderMermaid, THEMES } from 'beautiful-mermaid'

// Use a built-in theme
const svg = await renderMermaid(diagram, THEMES['tokyo-night'])

// Available themes:
THEMES['zinc-light']
THEMES['zinc-dark']
THEMES['tokyo-night']
THEMES['tokyo-night-storm']
THEMES['tokyo-night-light']
THEMES['catppuccin-mocha']
THEMES['catppuccin-latte']
THEMES['nord']
THEMES['nord-light']
THEMES['dracula']
THEMES['github-light']
THEMES['github-dark']
THEMES['solarized-light']
THEMES['solarized-dark']
THEMES['one-dark']
```

### Custom Theme (Mono Mode)

```typescript
// Just two colors - the system derives everything
const svg = await renderMermaid(diagram, {
  bg: '#1a1b26',  // Background
  fg: '#a9b1d6',  // Foreground
})
```

### Enriched Theme

```typescript
const svg = await renderMermaid(diagram, {
  bg: '#1a1b26',
  fg: '#a9b1d6',
  line: '#3d59a1',    // Edge color
  accent: '#7aa2f7',  // Arrow heads
  muted: '#565f89',   // Secondary text
  surface: '#292e42', // Node fill
  border: '#3d59a1',  // Node stroke
})
```

### Shiki Theme Compatibility

```typescript
import { renderMermaid, fromShikiTheme } from 'beautiful-mermaid'
import { getHighlighter } from 'shiki'

const highlighter = await getHighlighter({ theme: 'vitesse-dark' })
const colors = fromShikiTheme(highlighter.getTheme('vitesse-dark'))
const svg = await renderMermaid(diagram, colors)
```

## ASCII/Unicode Output

For terminal environments:

```typescript
import { renderMermaidAscii } from 'beautiful-mermaid'

// Unicode (prettier, default)
const unicode = renderMermaidAscii(`graph LR; A --> B`)

// Pure ASCII (maximum compatibility)
const ascii = renderMermaidAscii(`graph LR; A --> B`, { useAscii: true })

// Custom spacing
renderMermaidAscii(diagram, {
  useAscii: false,
  paddingX: 5,          // Horizontal spacing
  paddingY: 5,          // Vertical spacing
  boxBorderPadding: 1,  // Inner padding
})
```

## API Reference

### renderMermaid(text, options?): Promise<string>

Render Mermaid to SVG.

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `bg` | string | `#FFFFFF` | Background color |
| `fg` | string | `#27272A` | Foreground color |
| `line` | string? | — | Edge color |
| `accent` | string? | — | Arrow heads, highlights |
| `muted` | string? | — | Secondary text |
| `surface` | string? | — | Node fill tint |
| `border` | string? | — | Node stroke |
| `font` | string | `Inter` | Font family |
| `transparent` | boolean | `false` | Transparent background |

### renderMermaidAscii(text, options?): string

Render Mermaid to ASCII/Unicode. Synchronous.

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `useAscii` | boolean | `false` | Use ASCII instead of Unicode |
| `paddingX` | number | `5` | Horizontal node spacing |
| `paddingY` | number | `5` | Vertical node spacing |
| `boxBorderPadding` | number | `1` | Inner box padding |

### THEMES: Record<string, DiagramColors>

All 15 built-in themes.

### fromShikiTheme(theme): DiagramColors

Extract diagram colors from Shiki theme.

## Usage in OpenClaw

### Telegram Integration

For Telegram, render as SVG and send as photo:

```typescript
import { renderMermaid } from 'beautiful-mermaid'

async function sendMermaid(message: string) {
  const blocks = extractMermaidBlocks(message)
  
  for (const block of blocks) {
    const svg = await renderMermaid(block.code, THEMES['tokyo-night'])
    // Send SVG as photo to Telegram
  }
}
```

### Terminal/CLI Output

```typescript
import { renderMermaidAscii } from 'beautiful-mermaid'

function printDiagram(code: string) {
  const ascii = renderMermaidAscii(code)
  console.log(ascii)
}
```

## Performance

- **100+ diagrams** in under 500ms
- **Zero DOM dependencies** - pure TypeScript
- **Ultra-fast** - no browser/Puppeteer needed

## Comparison to Alternatives

| Feature | beautiful-mermaid | mmdc |
|---------|------------------|------|
| Dependencies | Zero DOM | Puppeteer |
| Speed | <500ms for 100+ diagrams | Slower |
| ASCII output | ✅ Native | ❌ No |
| Themes | 15 built-in + Shiki | CSS |
| Size | Lightweight | Heavy |

## Example Workflow

**Input:**
```
Here is the system architecture:

\`\`\`mermaid
graph TD
  User --> LB[Load Balancer]
  LB --> API[API Server]
  API --> DB[(Database)]
  API --> Cache
\`\`\`

And the flow:

\`\`\`mermaid
sequenceDiagram
  participant U as User
  participant A as API
  U->>A: Request
  A-->>U: Response
\`\`\`
```

**Action:** Render both diagrams with appropriate theme.

**Output:** Send two SVG images with captions.

## Resources

- **npm:** https://www.npmjs.com/package/beautiful-mermaid
- **GitHub:** https://github.com/lukilabs/beautiful-mermaid
- **Live Demo:** https://agents.craft.do/mermaid
