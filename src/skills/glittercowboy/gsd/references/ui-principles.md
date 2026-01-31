---
name: ui-principles
description: Professional UI/UX design principles for high-quality interfaces
load_when:
  - design
  - ui
  - frontend
  - component
  - layout
  - mockup
auto_load_for: []
---

<ui_principles>

## Overview

Professional UI design principles that ensure high-quality, polished interfaces. These are non-negotiable standards—not suggestions.

## Visual Hierarchy

### Establish Clear Priority

Every screen has one primary action. Make it obvious.

**Weight hierarchy:**
1. Primary action (bold, prominent, singular)
2. Secondary actions (visible but subdued)
3. Tertiary actions (discoverable but not competing)

**Size signals importance:**
- Headings > body text > captions
- Primary buttons > secondary > tertiary
- Key metrics > supporting data

### Whitespace Is Not Empty

Whitespace is a design element. It:
- Groups related items
- Separates unrelated items
- Creates breathing room
- Signals quality

**Minimum spacing guidelines:**
- Between unrelated sections: 32-48px
- Between related items: 16-24px
- Internal padding: 12-16px
- Touch targets: 44px minimum

## Typography

### Establish a Type Scale

Use a consistent mathematical scale. Example (1.25 ratio):
```
12px - Caption/small
14px - Body small
16px - Body (base)
20px - H4
24px - H3
32px - H2
40px - H1
```

### Font Weights

Limit to 2-3 weights maximum:
- Regular (400) - Body text
- Medium (500) - Emphasis, labels
- Bold (700) - Headings, key actions

### Line Height

- Body text: 1.5-1.6
- Headings: 1.2-1.3
- Captions: 1.4

### Maximum Line Width

Body text: 60-75 characters. Longer lines reduce readability.

## Color

### Build a Palette

**Semantic colors:**
- Primary: Brand/action color
- Secondary: Supporting accent
- Success: #22C55E range (green)
- Warning: #F59E0B range (amber)
- Error: #EF4444 range (red)
- Info: #3B82F6 range (blue)

**Neutral scale:**
Build 9-11 shades from near-white to near-black:
```
50  - Backgrounds, subtle borders
100 - Hover states, dividers
200 - Disabled states
300 - Borders
400 - Placeholder text
500 - Secondary text
600 - Body text (dark mode)
700 - Body text (light mode)
800 - Headings
900 - High contrast text
950 - Near black
```

### Contrast Requirements

- Body text: 4.5:1 minimum (WCAG AA)
- Large text (18px+): 3:1 minimum
- Interactive elements: 3:1 against background

## Layout

### Grid Systems

Use a consistent grid:
- 4px base unit for spacing
- 8px increments for larger spacing
- 12-column grid for responsive layouts

### Responsive Breakpoints

```
sm:  640px   - Mobile landscape
md:  768px   - Tablets
lg:  1024px  - Small desktops
xl:  1280px  - Standard desktops
2xl: 1536px  - Large displays
```

### Content Width

- Maximum content width: 1200-1440px
- Prose/reading: 680-720px
- Forms: 480-560px

## Components

### Buttons

**States (all buttons must have):**
- Default
- Hover
- Active/pressed
- Focus (visible outline)
- Disabled
- Loading (if applicable)

**Sizing:**
- Small: 32px height, 12px horizontal padding
- Medium: 40px height, 16px horizontal padding
- Large: 48px height, 24px horizontal padding

### Form Inputs

**States:**
- Default
- Hover
- Focus (prominent ring)
- Error (red border + message)
- Disabled
- Read-only

**Guidelines:**
- Labels above inputs (not inside)
- Helper text below inputs
- Error messages replace helper text
- Required indicator: asterisk after label

### Cards

**Structure:**
- Optional media (top or left)
- Content area with consistent padding
- Optional footer for actions
- Subtle shadow or border

**Guidelines:**
- Consistent border radius (8px is standard)
- Don't overload with actions
- Group related cards visually

## Interaction

### Feedback

Every action needs feedback:
- Button click: Visual press state
- Form submission: Loading state → success/error
- Navigation: Active state indication
- Background processes: Progress indication

### Transitions

**Duration:**
- Micro interactions: 100-150ms
- UI transitions: 200-300ms
- Page transitions: 300-500ms

**Easing:**
- Entering: ease-out
- Exiting: ease-in
- Moving: ease-in-out

### Loading States

Never leave users wondering:
- Skeleton screens for content loading
- Spinners for brief waits
- Progress bars for longer operations
- Disable interactive elements during submission

## Anti-Patterns

### Visual Noise

**Problem:** Too many colors, borders, shadows competing
**Fix:** Reduce to essentials. When in doubt, remove.

### Inconsistent Spacing

**Problem:** Random margins and padding throughout
**Fix:** Use spacing scale religiously (4, 8, 12, 16, 24, 32, 48...)

### Orphan Elements

**Problem:** Single items floating with no visual relationship
**Fix:** Group related elements. Use proximity and shared styling.

### Weak Hierarchy

**Problem:** Everything looks equally important
**Fix:** Make primary action 2x more prominent. Reduce secondary elements.

### Over-Decoration

**Problem:** Gradients, shadows, borders, rounded corners all at once
**Fix:** Pick 1-2 decorative elements per component max.

## Professional Polish Checklist

- [ ] Consistent spacing throughout
- [ ] Type scale followed exactly
- [ ] Color palette limited and purposeful
- [ ] All interactive states designed
- [ ] Proper contrast ratios
- [ ] Touch targets 44px+
- [ ] Loading states for all async operations
- [ ] Error states for all forms
- [ ] Focus states visible for keyboard navigation
- [ ] No orphan elements
- [ ] Clear visual hierarchy

</ui_principles>
