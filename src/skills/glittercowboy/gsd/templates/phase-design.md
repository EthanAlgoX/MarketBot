---
name: phase-design-template
description: Template for phase-specific UI design documentation
used_by:
  - discuss-design
placeholders:
  - phase_number
  - phase_name
  - components
  - layouts
  - interactions
  - mockup_files
---

<template>

# Phase {phase_number}: {phase_name} - Design

**Created:** {date}
**Design System:** @.planning/DESIGN-SYSTEM.md

## Overview

{design_overview}

---

## Components

{?new_components}
### New Components

| Component | Purpose | States |
|-----------|---------|--------|
{new_components}

{/new_components}

{?modified_components}
### Modified Components

| Component | Changes | Reason |
|-----------|---------|--------|
{modified_components}

{/modified_components}

### Component Specifications

{component_specs}

---

## Layouts

### Screen/Page Layouts

{layout_descriptions}

### Responsive Behavior

| Breakpoint | Layout Changes |
|------------|----------------|
{responsive_changes}

---

## Interactions

### User Flows

{user_flows}

### States & Transitions

{state_transitions}

### Loading States

{loading_states}

### Error States

{error_states}

---

## Mockups

| File | Description | Status |
|------|-------------|--------|
{mockup_files}

### Running Mockups

```bash
{mockup_run_command}
```

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
{design_decisions}

---

## Implementation Notes

{implementation_notes}

---

## Checklist

- [ ] All new components specified
- [ ] States defined for each component
- [ ] Responsive behavior documented
- [ ] Mockups reviewed and approved
- [ ] Follows design system
- [ ] Accessibility considered

</template>

<guidelines>

## Filling This Template

**{design_overview}:** 2-3 sentences summarizing what UI this phase introduces or changes.

**{new_components}:** Table of components created in this phase:
```
| PostCard | Displays a social media post | default, loading, error, empty |
| LikeButton | Heart animation on like | idle, hovering, liked, animating |
```

**{component_specs}:** Detailed specs for each component. Include:
- Visual description
- Props/parameters
- Variants
- All states with visual differences
- Accessibility requirements

**{layout_descriptions}:** Describe how screens are structured. Include:
- Grid/flex layout approach
- Content ordering
- Key regions (header, main, sidebar, etc.)

**{user_flows}:** Describe interaction sequences:
```
1. User sees post in feed
2. Hovers over like button → heart outline highlights
3. Clicks like → heart fills with animation
4. Like count increments
```

**{mockup_files}:** List of mockup files created:
```
| mockups/PostCard.tsx | Post card component preview | ✓ Approved |
| mockups/Feed.tsx | Full feed layout | ✓ Approved |
```

</guidelines>

<examples>

## Good Component Spec

```markdown
### PostCard

**Purpose:** Displays a single post in the feed with author info, content, and engagement actions.

**Structure:**
- Header: Avatar (40px), Author name, Timestamp
- Content: Text (max 280 chars), optional media
- Footer: Like, Comment, Share actions with counts

**Variants:**
- `default` - Standard post display
- `compact` - Reduced padding for dense feeds
- `featured` - Highlighted border for promoted content

**States:**
- Loading: Skeleton with pulsing animation
- Error: "Failed to load" with retry button
- Empty media: Placeholder with broken image icon

**Accessibility:**
- Author name is a link with focus ring
- Action buttons have aria-labels with counts
- Media has alt text from post data
```

## Bad Component Spec

```markdown
### PostCard

A card for posts. Has a like button.
```

</examples>
