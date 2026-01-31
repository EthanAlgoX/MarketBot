---
name: design-system-template
description: Template for project-wide design system documentation
used_by:
  - design-system
placeholders:
  - project_name
  - aesthetic_summary
  - color_palette
  - typography
  - spacing
  - components
  - patterns
---

<template>

# Design System

**Project:** {project_name}
**Framework:** {framework}
**Created:** {date}

## Aesthetic Direction

{aesthetic_summary}

{?inspiration}
### Visual References

{inspiration_description}

{/inspiration}

---

## Color Palette

### Brand Colors

| Name | Value | Usage |
|------|-------|-------|
{brand_colors}

### Semantic Colors

| Purpose | Light Mode | Dark Mode |
|---------|------------|-----------|
| Success | {success_light} | {success_dark} |
| Warning | {warning_light} | {warning_dark} |
| Error | {error_light} | {error_dark} |
| Info | {info_light} | {info_dark} |

### Neutral Scale

```
{neutral_scale}
```

---

## Typography

### Font Stack

**Primary:** {font_primary}
**Monospace:** {font_mono}

### Type Scale

| Name | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
{type_scale}

### Text Styles

{text_styles}

---

## Spacing

### Base Unit

{spacing_base}

### Scale

```
{spacing_scale}
```

### Common Spacing Patterns

| Context | Value |
|---------|-------|
{spacing_patterns}

---

## Components

### Buttons

{button_specs}

### Inputs

{input_specs}

### Cards

{card_specs}

{?additional_components}
### Additional Components

{additional_components}
{/additional_components}

---

## Layout

### Breakpoints

| Name | Width | Usage |
|------|-------|-------|
{breakpoints}

### Grid

{grid_specs}

### Content Width

{content_width}

---

## Interaction

### Transitions

| Type | Duration | Easing |
|------|----------|--------|
{transitions}

### Feedback Patterns

{feedback_patterns}

---

## Accessibility

### Contrast Requirements

{contrast_requirements}

### Focus States

{focus_states}

### Touch Targets

{touch_targets}

---

## Implementation Notes

{implementation_notes}

</template>

<guidelines>

## Filling This Template

**{aesthetic_summary}:** 2-3 sentences describing the overall visual direction. Examples:
- "Clean and minimal with generous whitespace. Emphasis on typography over decoration. Subtle shadows for depth."
- "Bold and energetic with high contrast. Geometric shapes and strong color accents. Modern and confident."

**{brand_colors}:** Table rows with color name, hex value, and where it's used. Example:
```
| Primary | #2563EB | Buttons, links, key actions |
| Primary Light | #3B82F6 | Hover states, backgrounds |
| Accent | #8B5CF6 | Highlights, tags, badges |
```

**{type_scale}:** Table rows for each heading level and body text. Example:
```
| H1 | 40px | Bold | 1.2 | Page titles |
| H2 | 32px | Bold | 1.25 | Section headers |
| Body | 16px | Regular | 1.5 | Paragraphs |
| Small | 14px | Regular | 1.4 | Captions, labels |
```

**{button_specs}:** Describe button variants with sizes, colors, states. Include code-ready values.

**{spacing_scale}:** List spacing values. Example:
```
4px  - xs  - Tight spacing, inline elements
8px  - sm  - Related items, compact layouts
16px - md  - Standard padding, gaps
24px - lg  - Section spacing
32px - xl  - Major section breaks
48px - 2xl - Page-level spacing
```

</guidelines>

<examples>

## Good Example

```markdown
## Aesthetic Direction

Professional and trustworthy with a modern edge. Clean layouts with purposeful whitespace. Subtle depth through soft shadows. Typography-driven hierarchy—minimal decorative elements.

### Visual References

Inspired by Linear, Stripe, and Notion. Combines Linear's clean aesthetic with Stripe's attention to detail.
```

## Bad Example

```markdown
## Aesthetic Direction

Nice looking design.
```

The bad example is too vague to guide implementation decisions.

</examples>
