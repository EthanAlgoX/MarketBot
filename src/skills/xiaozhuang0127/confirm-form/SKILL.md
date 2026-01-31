---
name: confirm-form
description: Generate structured confirmation forms to collect user feedback on multiple questions. Use when completing work that needs user review, when multiple issues need batch confirmation, or when the user needs to choose between options with detailed context. Triggers include review, confirm, batch questions, multiple choices, need user input on several items.
---

# Confirm Form

Generate HTML forms for structured user confirmation, upload to GitHub Gist, and parse responses.

## Quick Start

### 1. Prepare Questions JSON

```json
[
  {
    "title": "Question title",
    "context": "Background: what I was working on",
    "uncertainty": "What specifically I cannot decide alone",
    "findings": [
      { "content": "Finding 1", "source": "Source A" },
      { "content": "Finding 2", "source": "Source B" }
    ],
    "judgment": "My recommendation and reasoning",
    "options": [
      { "label": "Option A", "basis": "Rationale for A" },
      { "label": "Option B", "basis": "Rationale for B【我的推荐】" },
      { "label": "Need more info", "basis": "If none of the above fits" }
    ]
  }
]
```

### 2. Generate Form

```bash
node scripts/generate.js questions.json
```

Output includes:
- Local HTML file
- GitHub Gist URL
- Preview link (htmlpreview.github.io)

### 3. Send Link to User

Send the preview URL. User fills the form and copies the result JSON back.

### 4. Parse Response

User response structure:
```json
{
  "formId": "form-20260130-180000",
  "timestamp": "...",
  "globalFeedback": "all_ok|need_more_info|discuss|null",
  "globalComment": "Overall feedback",
  "summary": { "total": 3, "answered": 3, "agreedWithAI": 2 },
  "answers": [
    {
      "question": "Question title",
      "selectedLabel": "Option B",
      "customAnswer": "User's custom input if any",
      "agreedWithMyJudgment": true
    }
  ]
}
```

## Question Design Guidelines

### Required Fields
- `title`: Clear, concise question title
- `options`: At least 2 options, each with `label`

### Recommended Fields
- `context`: Background - what was I working on
- `uncertainty`: Why I need to ask - what blocks my decision
- `findings`: Evidence with sources - show original text, not just summaries
- `judgment`: My recommendation with reasoning

### Option Design
- Add `basis` (rationale) to each option
- Mark recommended option with `【我的推荐】` in basis
- Include "Need more information" as fallback option

### Quality Principles
1. **Give full context** - Show original text, not just extracted numbers
2. **Explain uncertainty** - Why can't I decide alone?
3. **Cite sources** - Where did each finding come from?
4. **Justify recommendations** - Why do I lean this way?

## Workflow Integration

### CC Task Integration

When CC completes a task that needs user confirmation, include in CC prompt:

```
如果有需要主人确认的问题，在任务最后生成 questions.json 文件，格式：
[{"title":"问题","context":"背景","uncertainty":"不确定点","findings":[...],"judgment":"判断","options":[...]}]
```

After CC completes, check for questions.json and generate form if exists.

### Response Archiving

After receiving user response, save to archive:
```
~/clawd/records/confirm-form/YYYY-MM-DD_<formId>.json
```

Archive format:
```json
{
  "formId": "...",
  "createdAt": "...",
  "respondedAt": "...",
  "questions": [...],
  "response": {...}
}
```

Use for: reviewing past decisions, tracking confirmation patterns.

## Files

- `scripts/generate.js` - Form generator script
- `assets/template.html` - HTML form template (copy-paste mode)
- `assets/template-v2.html` - HTML form template (auto-notify mode, experimental)
- `assets/examples/sample.json` - Example questions
