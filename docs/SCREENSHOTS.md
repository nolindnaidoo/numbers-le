# Numbers-LE Visual Documentation

## Overview

This document catalogs all visual assets for Numbers-LE, including screenshots, GIFs, and diagrams used in documentation and marketplace listings.

**Current Status:** ✅ Core screenshots available (preview.gif, command-palette.png, coverage-report.png)

---

## Required Screenshots

### 1. Command Palette

**Status:** ✅ Available  
**File:** `src/assets/images/command-palette.png`  
**Priority:** HIGH

**Captures:**

- Open Command Palette (Cmd/Ctrl+Shift+P)
- Type "Numbers-LE" showing all commands:
  - Numbers-LE: Extract Numbers
  - Numbers-LE: Post-Process: Deduplicate
  - Numbers-LE: Post-Process: Sort
  - Numbers-LE: Post-Process: Analyze
  - Numbers-LE: Toggle CSV Streaming
  - Numbers-LE: Open Settings
  - Numbers-LE: Help & Troubleshooting
- Show keyboard shortcut (Ctrl+Alt+N / Cmd+Alt+N)

**Usage:** README.md, marketplace listing

![Command Palette](../src/assets/images/command-palette.png)

---

### 2. Settings Panel

**Status:** 📅 Planned  
**File:** `src/assets/images/settings-panel.png`  
**Priority:** HIGH

**Captures:**

- Open Settings UI (Cmd/Ctrl+,)
- Search for "numbers-le"
- Show visible settings:
  - Dedupe Enabled
  - Sort Enabled / Sort Mode
  - Copy to Clipboard Enabled
  - Open Results Side by Side
  - Status Bar: Enabled
  - CSV: Streaming Enabled
  - Analysis: Enabled / Include Stats
  - Safety: Enabled / thresholds
  - Notifications Level
  - Performance settings

**Usage:** CONFIGURATION.md, marketplace listing

---

### 3. CSV Streaming Animation

**Status:** 📅 Planned  
**File:** `src/assets/images/csv-streaming.gif`  
**Priority:** MEDIUM

**Captures:**

- Open large CSV file (>10MB)
- Enable CSV streaming in settings
- Run "Numbers-LE: Extract Numbers"
- Record incremental extraction (batches being appended)
- Show progress notification
- Show completion with count

**Duration:** 10-15 seconds  
**Format:** Optimized GIF (<5MB)

**Usage:** README.md performance section

---

### 4. Extraction Results Side-by-Side

**Status:** 📅 Planned  
**File:** `src/assets/images/results-side-by-side.png`  
**Priority:** HIGH

**Captures:**

- Open JSON/YAML file with numbers
- Enable "Open Results Side by Side" setting
- Run extraction
- Show source file (left) and extracted numbers (right)
- Highlight split view

**Usage:** README.md quick start, marketplace listing

---

### 5. Sort Mode Picker

**Status:** 📅 Planned  
**File:** `src/assets/images/sort-mode-picker.png`  
**Priority:** MEDIUM

**Captures:**

- Run "Numbers-LE: Post-Process: Sort"
- Show QuickPick with options:
  - Numeric Ascending
  - Numeric Descending
  - Magnitude Ascending (by absolute value)
  - Magnitude Descending (by absolute value)

**Usage:** COMMANDS.md, marketplace listing

---

### 6. Status Bar

**Status:** 📅 Planned  
**File:** `src/assets/images/status-bar.png`  
**Priority:** MEDIUM

**Captures:**

- Status bar with Numbers-LE item visible
- Hover tooltip showing "Run Numbers-LE: Extract"
- Show variants:
  - Normal: `$(symbol-number) Numbers-LE`
  - CSV Streaming: `$(symbol-number) Numbers-LE (CSV Streaming)`
  - Success indicator (temporary, 3s)

**Usage:** STATUSBAR.md, README.md

---

### 7. Notifications

**Status:** 📅 Planned  
**File:** `src/assets/images/notifications.png`  
**Priority:** MEDIUM

**Captures:**

- Composite image showing notification types:
  - Info: "182 numbers extracted"
  - Warning: "Large file detected..."
  - Error: "No active editor"
  - Success flash in status bar

**Usage:** NOTIFICATIONS.md

---

### 8. Large Output Prompt

**Status:** 📅 Planned  
**File:** `src/assets/images/large-output-prompt.png`  
**Priority:** LOW

**Captures:**

- Extract from file producing >50,000 numbers
- Modal dialog:
  - Title: "Large Output Detected"
  - Message: explaining threshold
  - Buttons: "Open in Editor", "Copy to Clipboard", "Cancel"

**Usage:** PERFORMANCE.md, safety documentation

---

### 9. Analysis Results

**Status:** 📅 Planned  
**File:** `src/assets/images/analysis-results.png`  
**Priority:** HIGH

**Captures:**

- Run "Numbers-LE: Post-Process: Analyze"
- Show analysis output:
  - Total Count, Unique Count
  - Range (min/max)
  - Mean, Median, Mode
  - Standard Deviation, Variance
  - Outliers
  - Trends

**Usage:** README.md, marketplace listing

---

### 10. Test Results

**Status:** ✅ Available  
**File:** `src/assets/images/test-results.png` or `coverage-report.png`  
**Priority:** MEDIUM

**Captures:**

- Terminal output from `bun test`
- Show:
  - Test count and pass rate
  - Test files executed
  - Duration
  - Clean output with checkmarks

**Usage:** README.md, TESTING.md

---

### 11. Coverage Report (HTML)

**Status:** ✅ Available  
**File:** `src/assets/images/coverage-report.png`  
**Priority:** LOW

**Captures:**

- `coverage/index.html` in browser
- HTML coverage report landing page
- Highlight high coverage areas (green)
- File tree structure

**Usage:** TESTING.md

---

## Screenshot Guidelines

### Technical Requirements

**Resolution:**

- Minimum 1440px wide
- 2x retina for marketplace (2880px)
- Consistent across all screenshots

**Format:**

- PNG for static images
- GIF for animations
- Optimize with ImageOptim or similar

**Color & Theme:**

- Use popular dark theme (One Dark Pro, Dracula)
- Ensure text is readable
- Match VS Code's native UI

### Composition

**Framing:**

- Clean workspace (close unnecessary panels)
- Show context (file explorer when relevant)
- Focus on the feature
- Minimal distractions

**Annotations:**

- Add arrows/highlights only when necessary
- Use subtle colors that match theme
- Keep annotations minimal

**Consistency:**

- Same theme across all screenshots
- Same font size (14-16px)
- Same window size ratio

### Sample Data

Create realistic sample files in `test/fixtures/`:

- `sample-numbers.json` - JSON with various numeric types
- `sample-data.yaml` - YAML with nested numbers
- `large-data.csv` - CSV for streaming demo (10MB+)
- `stats-demo.json` - Dataset for analysis showcase

---

## Recording GIFs

### Tools

- **macOS:** Gifski, Kap
- **Windows:** ScreenToGif
- **Linux:** Peek, SimpleScreenRecorder + Gifski

### Settings

- Frame rate: 15-20 fps (balance quality/size)
- Duration: 10-15 seconds maximum
- Resolution: 1440px wide minimum
- File size: <5MB (optimize aggressively)

### Process

1. Set up clean VS Code window
2. Prepare sample file
3. Start recording
4. Perform action slowly and deliberately
5. Stop recording
6. Optimize with Gifski: `gifski --fps 15 --quality 90 input.mp4 -o output.gif`

---

## Placeholder Status

Until screenshots are captured, use these placeholders in documentation:

```markdown
![Command Palette](../../src/assets/images/command-palette.png)

<!-- Placeholder: Screenshot pending for v1.1.0 -->
```

Or reference existing coverage screenshot:

```markdown
![Coverage Report](../../src/assets/images/coverage-report.png)
```

---

## Marketplace Listing Requirements

**Primary screenshot (required):**

- Feature showcase or extraction demo
- 1280x800px minimum
- Shows core value proposition

**Additional screenshots (recommended 3-5):**

1. Command palette
2. Results side-by-side
3. Analysis results
4. Settings panel
5. CSV streaming (GIF if possible)

**Banner (optional):**

- 1280x640px
- Brand colors and logo
- Clear tagline

---

## Update Schedule

**v1.0.x:** English documentation complete, screenshots pending  
**v1.1.0:** All screenshots captured and integrated  
**v1.2.0:** Localized screenshots for major languages

---

**Next Steps:**

1. Create sample data files
2. Set up recording environment
3. Capture priority HIGH screenshots first
4. Optimize and commit to repository
5. Update documentation with real screenshots

**Questions?** See [SCREENSHOTS_NEEDED.md](../SCREENSHOTS_NEEDED.md) for detailed capture instructions.
