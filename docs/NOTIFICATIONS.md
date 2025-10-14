# Numbers-LE Notification System

## Overview

Numbers-LE uses a smart notification system that respects your workflow. By default, it runs silently, only showing notifications when something truly needs your attention.

## Notification levels

Configure via `numbers-le.notificationsLevel`:

### `silent` (default)

Zero notification spam. The extension works quietly in the background:

- ✅ Status bar updates still show
- ✅ Clipboard operations happen silently
- ❌ No toast notifications
- ❌ No success/info messages

**Best for:** Developers who know the extension well and don't want interruptions.

### `important`

Shows only critical notifications:

- ✅ Safety warnings (large files, large outputs)
- ✅ Error messages (parse failures, invalid files)
- ❌ Success messages
- ❌ Info messages

**Best for:** Most users. Get alerted to problems without noise.

### `all`

Shows every notification:

- ✅ Success messages ("182 numbers extracted")
- ✅ Info messages ("CSV streaming enabled")
- ✅ Safety warnings
- ✅ Error messages
- ✅ Parse error details (if `showParseErrors` enabled)

**Best for:** Debugging, learning the extension, or just wanting feedback.

---

## Notification types

### ✅ Success notifications

**Level:** `all` only

Confirm successful operations:

```
✓ Extracted 182 numbers - copied to clipboard
✓ Removed 5 duplicates (177 unique numbers)
✓ Sorted 182 numbers (Numeric Ascending)
```

**Purpose:** Positive feedback that operation completed.

### ℹ️ Info notifications

**Level:** `all` only

Provide context or tips:

```
ℹ CSV results aren't auto-copied when streaming. Use the editor output or Copy manually.
ℹ Detected multi-line numbers. Rendering may vary by format.
ℹ No numbers found in the file
```

**Purpose:** Help users understand edge cases or behavior.

### ⚠️ Warning notifications

**Level:** `important` and `all`

Alert to potential issues before they become problems:

```
⚠ Large file detected (15 MB). Processing may take longer.
⚠ Large output detected (75,000 numbers). Opening may be slow.
⚠ Many documents already open (10). Consider closing some.
```

**Purpose:** Give users a chance to cancel or adjust before continuing.

**User actions:**

- Proceed anyway (operation continues)
- Cancel (operation aborts)
- Adjust settings (open settings panel)

### ❌ Error notifications

**Level:** `important` and `all`

Report failures that prevent operation completion:

```
✗ No active editor
✗ Failed to parse file: Invalid JSON syntax
✗ Document is no longer valid
✗ Operation canceled by user
```

**Purpose:** Explain why something didn't work.

**User actions:**

- Fix the problem (edit file, open editor)
- Check documentation (link to help)
- Report issue (GitHub link)

---

## Configuration examples

### Minimal setup (silent workflow)

```json
{
  "numbers-le.notificationsLevel": "silent",
  "numbers-le.statusBar.enabled": true,
  "numbers-le.copyToClipboardEnabled": true
}
```

Result: Work flows through status bar and clipboard, no notifications.

### Balanced setup (recommended)

```json
{
  "numbers-le.notificationsLevel": "important",
  "numbers-le.safety.enabled": true,
  "numbers-le.showParseErrors": true
}
```

Result: Get warned about problems, stay informed about safety issues.

### Verbose setup (maximum feedback)

```json
{
  "numbers-le.notificationsLevel": "all",
  "numbers-le.showParseErrors": true,
  "numbers-le.telemetryEnabled": true
}
```

Result: See everything, great for debugging or learning.

---

## Parse error notifications

Controlled separately via `numbers-le.showParseErrors`:

```
✗ Parse error at line 15: Unexpected token }
✗ YAML parse error: Duplicate key 'count'
✗ CSV parse error: Unclosed quote on line 42
```

**When enabled:**

- Shows specific syntax errors with line numbers
- Helps debug malformed files
- Works with all notification levels

**When disabled:**

- Parse errors are logged to Output panel only
- Less noise, still accessible for debugging

---

## Status bar indicators

**Always visible** regardless of notification level:

```
$(symbol-number) Numbers-LE
$(symbol-number) Numbers-LE (CSV Streaming)
$(check) 182 numbers extracted
```

- Click to run extract command
- Tooltip shows current mode
- Temporary success indicator (3 seconds)

---

## Best practices

### Development workflow

Start verbose, dial down as you learn:

1. **Week 1:** `"notificationsLevel": "all"` - Learn all features
2. **Week 2:** `"notificationsLevel": "important"` - Keep safety net
3. **Week 3+:** `"notificationsLevel": "silent"` - Master mode

### Team environments

Recommend `important` level for consistency:

- New team members get helpful warnings
- Experienced users aren't overwhelmed
- Safety checks still protect everyone

### CI/automation

Use `silent` to avoid log spam:

```bash
# VS Code CLI with Numbers-LE
code --user-data-dir=/tmp/vscode-test \
     --settings '{"numbers-le.notificationsLevel": "silent"}'
```

---

## Troubleshooting notifications

### I'm not seeing any notifications

Check your notification level:

```json
{
  "numbers-le.notificationsLevel": "silent"
}
```

Change to `"important"` or `"all"` to see messages.

### Too many notifications

Reduce verbosity:

```json
{
  "numbers-le.notificationsLevel": "important",
  "numbers-le.showParseErrors": false
}
```

### Missing error details

Enable parse error display:

```json
{
  "numbers-le.showParseErrors": true
}
```

Check Output panel → "Numbers-LE" for full logs.

### Notification timing issues

Some notifications are modal (block workflow):

- Safety warnings before large operations
- Confirmation dialogs for destructive actions

Others are toast (auto-dismiss):

- Success messages
- Info tips

Configure thresholds to control when modals appear:

```json
{
  "numbers-le.safety.fileSizeWarnBytes": 5000000, // 5MB threshold
  "numbers-le.safety.largeOutputLinesThreshold": 100000 // 100K lines
}
```

---

## Output panel logging

**Always available** regardless of notification settings:

Open: View → Output → Select "Numbers-LE" from dropdown

Logs include:

- All notifications (even in silent mode)
- Performance metrics
- Error stack traces
- Telemetry events (if enabled)

Enable detailed logging:

```json
{
  "numbers-le.telemetryEnabled": true
}
```

---

## Accessibility

All notifications support:

- Screen readers (ARIA labels)
- High contrast themes
- Keyboard navigation

Toast notifications dismiss after 5 seconds or on click.
Modal dialogs require explicit user action.

---

**Current behavior:** Silent by default, configurable to three levels  
**Philosophy:** Respectful of your workflow, informative when needed
