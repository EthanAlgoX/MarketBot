# README Quality Guide

A good README explains what the skill does in a way that's both discoverable (SEO) and human-readable. This guide helps you write READMEs that work for both search engines and real people.

## The Goal

Someone searching for a solution should:
1. Find your skill through search
2. Understand what it does in 5 seconds
3. Know if it solves their problem
4. Get started quickly

## Structure That Works

```markdown
# Skill Name

[One sentence: what it does + who it's for]

## What This Does

[2-3 sentences explaining the core functionality in plain language]

## When You'd Use This

- [Specific scenario 1]
- [Specific scenario 2]
- [Specific scenario 3]

## Quick Example

[Show, don't tell - a real example of the skill in action]

## Getting Started

[Minimal steps to start using it]
```

## SEO Without Being Gross

### Do This

**Use natural phrases people actually search for:**
- "how to publish a skill"
- "check skill for secrets"
- "create new skill from template"

**Put the most important info first:**
> This skill helps you prepare AI assistant skills for public release by checking for secrets, validating structure, and ensuring documentation is complete.

**Be specific about what it does:**
> Scans markdown files for API keys, passwords, and hardcoded paths.

### Don't Do This

**Keyword stuffing:**
> This skill skill-publisher is the best skill for publishing skills to skill repositories and skill marketplaces for skills.

**Vague claims:**
> A comprehensive solution for all your skill management needs.

**Marketing fluff:**
> Revolutionary, game-changing, industry-leading skill publication platform.

## Human-Sounding Writing

Based on common AI writing patterns to avoid:

### Avoid These Phrases

| Don't Write | Write Instead |
|-------------|---------------|
| "serves as a testament to" | just explain what it does |
| "in the ever-evolving landscape of" | skip it entirely |
| "it's not just X, it's Y" | just say what it is |
| "comprehensive solution" | be specific about features |
| "seamless integration" | explain how it actually works |
| "robust and scalable" | describe actual capabilities |
| "leverage the power of" | "use" |
| "cutting-edge" | what specifically is new? |

### Avoid These Patterns

**Rule of three overkill:**
> ❌ Fast, reliable, and secure. Simple, powerful, and intuitive.
> ✓ Runs checks in under 5 seconds. Catches common security issues.

**Em dash overuse:**
> ❌ The tool—which was designed for developers—provides—among other things—validation.
> ✓ The tool validates skill files before publication.

**Vague authority claims:**
> ❌ Industry experts agree this is essential.
> ✓ [Just explain why it's useful]

**Generic positive conclusions:**
> ❌ The future of skill development looks bright!
> ✓ [End with something actionable]

## README Checklist

### Content
- [ ] First sentence explains what it does (no preamble)
- [ ] Clear use cases (when would someone need this?)
- [ ] At least one concrete example
- [ ] Installation/setup steps
- [ ] Links to related resources

### Discoverability
- [ ] Title matches what people search for
- [ ] Description uses natural search phrases
- [ ] Key features mentioned early
- [ ] Specific, not vague

### Tone
- [ ] Reads like a human wrote it
- [ ] No marketing buzzwords
- [ ] No AI-typical phrases (see list above)
- [ ] Varied sentence structure
- [ ] Active voice mostly

## Examples

### Bad README

> # SuperSkillMaster Pro
> 
> Welcome to SuperSkillMaster Pro! 🚀
> 
> SuperSkillMaster Pro serves as a comprehensive, end-to-end solution for all your skill management needs. In today's ever-evolving landscape of AI assistants, it's crucial to have robust, scalable tools that seamlessly integrate with your workflow.
> 
> ## Features
> 
> - **Powerful Validation:** Leverages cutting-edge algorithms
> - **Seamless Integration:** Works with all major platforms
> - **Enterprise-Ready:** Scalable and secure
> 
> The future of skill development is here. Join thousands of satisfied users!

**Problems:** Buzzwords, vague claims, no actual explanation of what it does, marketing tone, emoji decoration, rule-of-three bullet points.

### Good README

> # Skill Publisher
> 
> Check your AI assistant skills for common issues before sharing them publicly.
> 
> ## What it does
> 
> Scans skill files for secrets (API keys, passwords), hardcoded paths, and missing documentation. Generates a quality score and suggests fixes.
> 
> ## When you'd use this
> 
> - Before pushing a skill to GitHub
> - When reviewing someone else's skill
> - To catch accidentally committed credentials
> 
> ## Quick start
> 
> ```bash
> ./audit.sh /path/to/your/skill
> ```
> 
> Shows any issues found and how to fix them.

**Why it works:** Immediately clear what it does, specific features, concrete use cases, shows actual usage, no fluff.

## Quick Self-Test

Read your README out loud. Does it sound like:

1. A person explaining their project to a colleague? ✓
2. A press release or advertisement? ✗
3. ChatGPT describing itself? ✗

If it sounds like a person, you're good.
