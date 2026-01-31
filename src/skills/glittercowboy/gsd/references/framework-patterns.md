---
name: framework-patterns
description: Framework-specific UI patterns for React, SwiftUI, HTML/CSS, and Python frontends
load_when:
  - design
  - mockup
  - component
  - ui
auto_load_for: []
---

<framework_patterns>

## Overview

When creating mockups, match the project's framework. This reference covers patterns for major UI frameworks.

## Framework Detection

Detect project framework by checking:

```bash
# React/Next.js
ls package.json && grep -q '"react"' package.json && echo "react"

# SwiftUI
ls *.xcodeproj 2>/dev/null || ls Package.swift 2>/dev/null && echo "swift"

# Python web (Flask/Django/FastAPI with templates)
ls requirements.txt 2>/dev/null && grep -qE 'flask|django|fastapi' requirements.txt && echo "python"

# Pure HTML/CSS
ls index.html 2>/dev/null && echo "html"
```

## React/Next.js Patterns

### Component Structure

```tsx
interface ComponentNameProps {
  required: string;
  optional?: boolean;
  children?: React.ReactNode;
}

export function ComponentName({
  required,
  optional = false,
  children
}: ComponentNameProps) {
  return (
    <div className="component-name">
      {children}
    </div>
  );
}
```

### Styling Approach

**Tailwind CSS (preferred for mockups):**
```tsx
<button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
  Click me
</button>
```

**CSS Modules:**
```tsx
import styles from './Button.module.css';

<button className={styles.primary}>Click me</button>
```

### Component Categories

**Layout components:**
```tsx
// Container with max-width
export function Container({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {children}
    </div>
  );
}

// Stack (vertical)
export function Stack({ gap = 4, children }: { gap?: number; children: React.ReactNode }) {
  return <div className={`flex flex-col gap-${gap}`}>{children}</div>;
}

// Row (horizontal)
export function Row({ gap = 4, children }: { gap?: number; children: React.ReactNode }) {
  return <div className={`flex flex-row gap-${gap}`}>{children}</div>;
}
```

**Interactive components:**
```tsx
// Button with variants
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  onClick?: () => void;
}

export function Button({ variant = 'primary', size = 'md', children, onClick }: ButtonProps) {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
    ghost: 'bg-transparent hover:bg-gray-100',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      className={`rounded-lg font-medium transition-colors ${variants[variant]} ${sizes[size]}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
```

### Mockup File Structure

```
.planning/phases/XX-name/mockups/
├── index.tsx           # Main preview entry
├── components/
│   ├── Button.tsx
│   ├── Card.tsx
│   └── ...
└── preview.tsx         # Standalone preview component
```

### Preview Entry Point

```tsx
// .planning/phases/XX-name/mockups/preview.tsx
'use client';

import { Button } from './components/Button';
import { Card } from './components/Card';

export function DesignPreview() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold mb-8">Phase XX Design Preview</h1>

      <section className="mb-12">
        <h2 className="text-lg font-semibold mb-4">Buttons</h2>
        <div className="flex gap-4">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-lg font-semibold mb-4">Cards</h2>
        <Card title="Example Card">
          Card content here
        </Card>
      </section>
    </div>
  );
}
```

## SwiftUI Patterns

### View Structure

```swift
struct ComponentName: View {
    let title: String
    var subtitle: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.headline)

            if let subtitle {
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
    }
}
```

### Common Components

**Button styles:**
```swift
struct PrimaryButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.headline)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.accentColor)
                .cornerRadius(12)
        }
    }
}

struct SecondaryButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.headline)
                .foregroundColor(.accentColor)
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.accentColor.opacity(0.1))
                .cornerRadius(12)
        }
    }
}
```

**Card:**
```swift
struct Card<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding()
            .background(Color(.systemBackground))
            .cornerRadius(16)
            .shadow(color: .black.opacity(0.05), radius: 8, y: 4)
    }
}
```

### Mockup File Structure

```
.planning/phases/XX-name/mockups/
├── DesignPreview.swift      # Main preview
├── Components/
│   ├── Buttons.swift
│   ├── Cards.swift
│   └── ...
└── PreviewProvider.swift    # Xcode preview setup
```

### Preview Setup

```swift
// DesignPreview.swift
import SwiftUI

struct DesignPreview: View {
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 32) {
                    buttonsSection
                    cardsSection
                    formsSection
                }
                .padding()
            }
            .navigationTitle("Phase XX Design")
        }
    }

    private var buttonsSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Buttons")
                .font(.title2.bold())

            PrimaryButton(title: "Primary Action") {}
            SecondaryButton(title: "Secondary") {}
        }
    }

    // ... more sections
}

#Preview {
    DesignPreview()
}
```

## HTML/CSS Patterns

### File Structure

```
.planning/phases/XX-name/mockups/
├── index.html          # Main preview
├── styles.css          # All styles
└── components/         # Optional component HTML snippets
```

### Base HTML Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Phase XX Design Preview</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <main class="preview-container">
        <h1>Phase XX Design Preview</h1>

        <section class="component-section">
            <h2>Buttons</h2>
            <div class="component-grid">
                <button class="btn btn-primary">Primary</button>
                <button class="btn btn-secondary">Secondary</button>
                <button class="btn btn-ghost">Ghost</button>
            </div>
        </section>

        <!-- More sections -->
    </main>
</body>
</html>
```

### CSS Reset + Variables

```css
/* styles.css */
*, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

:root {
    /* Colors */
    --color-primary: #2563eb;
    --color-primary-hover: #1d4ed8;
    --color-secondary: #f3f4f6;
    --color-text: #111827;
    --color-text-secondary: #6b7280;
    --color-border: #e5e7eb;
    --color-background: #ffffff;
    --color-surface: #f9fafb;

    /* Spacing */
    --space-1: 0.25rem;
    --space-2: 0.5rem;
    --space-3: 0.75rem;
    --space-4: 1rem;
    --space-6: 1.5rem;
    --space-8: 2rem;

    /* Typography */
    --font-sans: system-ui, -apple-system, sans-serif;
    --font-size-sm: 0.875rem;
    --font-size-base: 1rem;
    --font-size-lg: 1.125rem;
    --font-size-xl: 1.25rem;
    --font-size-2xl: 1.5rem;

    /* Border radius */
    --radius-sm: 0.375rem;
    --radius-md: 0.5rem;
    --radius-lg: 0.75rem;
}

body {
    font-family: var(--font-sans);
    color: var(--color-text);
    background: var(--color-surface);
    line-height: 1.5;
}

/* Button component */
.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-2) var(--space-4);
    font-size: var(--font-size-base);
    font-weight: 500;
    border-radius: var(--radius-md);
    border: none;
    cursor: pointer;
    transition: all 0.15s ease;
}

.btn-primary {
    background: var(--color-primary);
    color: white;
}

.btn-primary:hover {
    background: var(--color-primary-hover);
}

.btn-secondary {
    background: var(--color-secondary);
    color: var(--color-text);
}

.btn-ghost {
    background: transparent;
}

.btn-ghost:hover {
    background: var(--color-secondary);
}
```

## Python Frontend Patterns

### Jinja2 Templates (Flask/Django)

```html
<!-- templates/components/button.html -->
{% macro button(text, variant='primary', size='md', type='button') %}
<button
    type="{{ type }}"
    class="btn btn-{{ variant }} btn-{{ size }}"
>
    {{ text }}
</button>
{% endmacro %}
```

```html
<!-- templates/preview.html -->
{% from "components/button.html" import button %}

<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="{{ url_for('static', filename='styles.css') }}">
</head>
<body>
    <h1>Design Preview</h1>

    <section>
        <h2>Buttons</h2>
        {{ button('Primary', 'primary') }}
        {{ button('Secondary', 'secondary') }}
    </section>
</body>
</html>
```

### Streamlit (for data apps)

```python
# mockup_preview.py
import streamlit as st

st.set_page_config(page_title="Phase XX Design", layout="wide")

st.title("Phase XX Design Preview")

with st.container():
    st.subheader("Buttons")
    col1, col2, col3 = st.columns(3)

    with col1:
        st.button("Primary", type="primary")
    with col2:
        st.button("Secondary")
    with col3:
        st.button("Ghost", type="secondary")

with st.container():
    st.subheader("Cards")
    with st.expander("Example Card", expanded=True):
        st.write("Card content goes here")
```

## Mockup Serving

### React/Next.js

Add to package.json scripts or run:
```bash
# If using Next.js app router
# Create app/mockups/page.tsx that imports preview

# Or use Storybook-lite approach
npx vite .planning/phases/XX-name/mockups
```

### SwiftUI

Open in Xcode, use Canvas preview (Cmd+Option+Enter)

### HTML/CSS

```bash
# Simple Python server
python -m http.server 8080 --directory .planning/phases/XX-name/mockups

# Or use live-server
npx live-server .planning/phases/XX-name/mockups
```

### Python

```bash
# Flask
FLASK_APP=mockup_preview.py flask run

# Streamlit
streamlit run mockup_preview.py
```

</framework_patterns>
