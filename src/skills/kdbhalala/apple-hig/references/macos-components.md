# macOS Components Reference

Quick reference for all macOS AppKit and SwiftUI components.

## Windows
- **NSWindow / Window** - Standard resizable window with traffic lights
- **NSPanel / Panel** - Utility window, floats above standard windows
- **NSPopover / .popover()** - Contextual content attached to view

## Navigation
- **NSSplitView / NavigationSplitView** - Sidebar + content layout
- **NSTabView / TabView** - Tabs for multiple views
- **NSOutlineView / OutlineGroup** - Hierarchical tree view
- **NSToolbar / .toolbar()** - Customizable toolbar below title bar

## Menus
- **NSMenu / Menu** - Context menus and menu bar items
- **NSMenuItem / Button(with menu)** - Individual menu items
- **NSPopUpButton / Picker(menu style)** - Dropdown selection

## Controls
- **NSButton / Button** - Push buttons, checkboxes, radio buttons
- **NSSegmentedControl / Picker(segmented)** - 2-5 mutually exclusive options
- **NSSlider / Slider** - Continuous value selection
- **NSStepper / Stepper** - Increment/decrement values
- **NSSwitch / Toggle** - On/off binary state (macOS 10.15+)
- **NSTextField / TextField** - Single-line text input
- **NSTextView / TextEditor** - Multi-line text input
- **NSSearchField / TextField + .searchable()** - Search input with icon

## Lists & Tables
- **NSTableView / Table** - Multi-column data display
- **NSOutlineView / OutlineGroup** - Expandable hierarchical list
- **NSCollectionView / LazyVGrid/LazyHGrid** - Grid layouts

## Indicators
- **NSProgressIndicator / ProgressView** - Progress bar or spinner
- **NSLevelIndicator** - Rating or capacity indicator

## Information
- **NSTextField (label) / Text** - Display text
- **NSImageView / Image** - Display images
- **NSAlert / .alert()** - Alert dialog with buttons

## Containers
- **NSBox / GroupBox** - Visually grouped controls
- **NSScrollView / ScrollView** - Scrollable content area
- **NSSplitView / VSplit/HSplit** - Resizable panes

See SKILL.md and macos.md for detailed usage patterns.
