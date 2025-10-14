# Numbers-LE Status Bar

## Overview

The Numbers-LE status bar provides quick access to extraction commands and visual feedback about the extension's state. It sits in the bottom-left corner of VS Code and updates dynamically based on your active file and settings.

## Status Bar States

### Normal Mode

```
$(symbol-number) Numbers-LE
```

**When shown:**

- Active editor contains a supported file type (JSON, YAML, CSV, TOML, INI, ENV)
- CSV streaming is disabled
- Extension is ready to extract

**Click action:** Runs `numbers-le.extractNumbers` command

**Tooltip:** "Run Numbers-LE: Extract" or "Extract numbers from current file (Ctrl+Alt+N)"

---

### CSV Streaming Mode

```
$(symbol-number) Numbers-LE (CSV Streaming)
```

**When shown:**

- Active editor contains a CSV file
- `numbers-le.csv.streamingEnabled` is `true`
- Large file detected or user preference

**Click action:** Runs `numbers-le.extractNumbers` with streaming enabled

**Tooltip:** "Extract with CSV streaming enabled"

---

### Success Indicator (Temporary)

```
$(check) 182 numbers extracted
```

**When shown:**

- Immediately after successful extraction
- Displays for 3 seconds
- Then reverts to normal/streaming mode

**Click action:** None (informational only)

**Tooltip:** Shows full success message

---

### Hidden State

Status bar is hidden when:

- `numbers-le.statusBar.enabled` is `false`
- No active editor
- Active file is unsupported type

---

## Configuration

### Enable/Disable

```json
{
  "numbers-le.statusBar.enabled": true // default
}
```

Set to `false` to completely hide the status bar item.

### Position

Status bar appears in the left alignment group with priority 100.

Cannot be customized (VS Code limitation).

---

## Behavior Details

### File Type Detection

Status bar updates automatically when:

- Switching between editor tabs
- Opening new files
- Saving files with different extensions

**Detection logic:**

1. Check file extension (`.json`, `.yaml`, `.csv`, etc.)
2. If unknown, prompt user to select file type on first extraction
3. Remember choice for that file until restart

### CSV Streaming Toggle

When you run `numbers-le.csv.toggleStreaming`:

- Status bar updates immediately
- Shows "(CSV Streaming)" suffix if enabled
- Persists across VS Code sessions

### Success Feedback

After extraction:

1. Status bar changes to success indicator
2. Shows number count
3. Auto-reverts after 3 seconds
4. Works even in `silent` notification mode

---

## Keyboard Shortcuts

**Primary shortcut:** `Ctrl+Alt+N` (Windows/Linux) or `Cmd+Alt+N` (macOS)

Clicking the status bar is equivalent to pressing the keyboard shortcut.

**Additional shortcuts:**

- `Ctrl+Alt+D` - Deduplicate
- `Ctrl+Alt+S` - Sort
- `Ctrl+Alt+A` - Analyze

(These don't appear in status bar, but are related commands)

---

## Integration with Other Features

### Works With

- **Command Palette:** Status bar and command palette both trigger same actions
- **Context Menu:** Right-click in editor also shows "Extract Numbers"
- **Notifications:** Status bar success indicator complements notifications

### Doesn't Conflict With

- Other extension status bars (each has own priority)
- VS Code native status items (language mode, line/column, etc.)

---

## Troubleshooting

### Status Bar Not Showing

**Check these settings:**

1. Status bar enabled?

   ```json
   {
     "numbers-le.statusBar.enabled": true
   }
   ```

2. Active file supported?

   - Open a `.json`, `.yaml`, or `.csv` file
   - Status bar only shows for supported types

3. Extension activated?
   - Check Extensions panel - Numbers-LE should show "Active"
   - Try reloading window (Cmd/Ctrl+R)

### Click Not Working

**Possible causes:**

1. **No active editor:** Open a file first
2. **Unsupported file:** Status bar is informational only for unknown types
3. **Extension error:** Check Output panel → "Numbers-LE" for errors

### Success Indicator Stuck

If success indicator doesn't revert after 3 seconds:

- Reload window (Cmd/Ctrl+R)
- Check for extension errors in Output panel

This is rare and usually indicates a timing issue.

---

## Customization Examples

### Minimal UI (hide status bar)

```json
{
  "numbers-le.statusBar.enabled": false
}
```

Use Command Palette or keyboard shortcuts exclusively.

### Power User (status bar + keyboard)

```json
{
  "numbers-le.statusBar.enabled": true,
  "numbers-le.keyboard.shortcuts.enabled": true
}
```

Both visual and keyboard workflows available.

---

## Accessibility

**Screen Reader Support:**

- Status bar item has ARIA label
- Success count is announced
- Tooltip provides context

**Keyboard Navigation:**

- Status bar clickable with Tab key
- Enter/Space activates command

**High Contrast:**

- Icons adapt to theme
- Text remains readable in all themes

---

## Technical Details

### Implementation

- Uses `vscode.window.createStatusBarItem()`
- Alignment: `vscode.StatusBarAlignment.Left`
- Priority: `100` (middle of left group)
- Disposed automatically on extension deactivate

### Icons

- `$(symbol-number)` - Native Codicon for numeric symbol
- `$(check)` - Native Codicon for checkmark

No custom icons needed.

### Update Frequency

- On editor change: immediate
- On config change: immediate
- On extraction: immediate
- Success indicator: 3-second timer

---

**Current implementation:** Functional, dynamic, respects user preferences  
**Future enhancements:** Possible configurable position/priority in v1.2.0
