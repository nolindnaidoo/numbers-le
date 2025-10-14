# Numbers-LE Configuration

## Overview

Numbers-LE provides comprehensive configuration options to customize its behavior while maintaining sensible defaults for most users. All settings are available through VS Code's settings UI and can be configured at the workspace or user level.

## Quick Reference

| Setting                                       | Type    | Default    | Description                                                                     |
| --------------------------------------------- | ------- | ---------- | ------------------------------------------------------------------------------- |
| `numbers-le.copyToClipboardEnabled`           | boolean | `false`    | Automatically copy extraction results to clipboard                              |
| `numbers-le.csv.streamingEnabled`             | boolean | `false`    | Stream CSV extraction incrementally into the editor                             |
| `numbers-le.dedupeEnabled`                    | boolean | `false`    | Enable automatic deduplication of extracted numbers                             |
| `numbers-le.notificationsLevel`               | enum    | `"silent"` | Notification verbosity: `all`, `important`, or `silent`                         |
| `numbers-le.postProcess.openInNewFile`        | boolean | `false`    | Open post-processed content in a new editor                                     |
| `numbers-le.openResultsSideBySide`            | boolean | `false`    | Open extraction results in a new editor to the side                             |
| `numbers-le.safety.enabled`                   | boolean | `true`     | Enable safety checks for large files and operations                             |
| `numbers-le.safety.fileSizeWarnBytes`         | number  | `1000000`  | Warn when input file size exceeds this threshold in bytes                       |
| `numbers-le.safety.largeOutputLinesThreshold` | number  | `50000`    | Warn before opening/copying when result lines exceed this threshold             |
| `numbers-le.safety.manyDocumentsThreshold`    | number  | `8`        | Warn before opening multiple result documents when count exceeds this threshold |
| `numbers-le.showParseErrors`                  | boolean | `false`    | Show parse errors as VS Code notifications when parsing fails                   |
| `numbers-le.sortEnabled`                      | boolean | `false`    | Enable automatic sorting of extracted numbers                                   |
| `numbers-le.sortMode`                         | enum    | `"off"`    | Selects how results are sorted when sorting is enabled                          |
| `numbers-le.statusBar.enabled`                | boolean | `true`     | Show Numbers-LE status bar entry for quick access                               |
| `numbers-le.telemetryEnabled`                 | boolean | `false`    | Enable local-only telemetry logs to the Output panel                            |
| `numbers-le.analysis.enabled`                 | boolean | `true`     | Enable automatic analysis of extracted numbers                                  |
| `numbers-le.analysis.includeStats`            | boolean | `true`     | Include statistical analysis in results                                         |

## Detailed Settings

### Core Functionality

#### `numbers-le.copyToClipboardEnabled`

- **Type**: `boolean`
- **Default**: `false`
- **Description**: Automatically copy extraction results to the clipboard instead of showing them in a notification.

#### `numbers-le.dedupeEnabled`

- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable automatic deduplication of extracted numbers. When enabled, duplicate numbers are removed from the results.

#### `numbers-le.sortEnabled`

- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable automatic sorting of extracted numbers. Requires `sortMode` to be set to a non-"off" value.

#### `numbers-le.sortMode`

- **Type**: `enum`
- **Default**: `"off"`
- **Options**:
  - `"off"`: No sorting (default)
  - `"numeric-asc"`: Sort numbers in ascending order (1, 2, 3, ...)
  - `"numeric-desc"`: Sort numbers in descending order (3, 2, 1, ...)
  - `"magnitude-asc"`: Sort by absolute value ascending (1, -2, 3, -4, ...)
  - `"magnitude-desc"`: Sort by absolute value descending (-4, 3, -2, 1, ...)

### Analysis Settings

#### `numbers-le.analysis.enabled`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable automatic analysis of extracted numbers. When enabled, basic statistics are calculated and included in the results.

#### `numbers-le.analysis.includeStats`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Include detailed statistical analysis in results. When enabled, provides mean, median, mode, standard deviation, variance, and outlier detection.

### User Interface

#### `numbers-le.notificationsLevel`

- **Type**: `enum`
- **Default**: `"silent"`
- **Options**:
  - `"all"`: Show all notifications (info, warnings, errors)
  - `"important"`: Show only important notifications (warnings, errors)
  - `"silent"`: Suppress all notifications

#### `numbers-le.statusBar.enabled`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Show Numbers-LE status bar entry for quick access to the main extraction command.

#### `numbers-le.postProcess.openInNewFile`

- **Type**: `boolean`
- **Default**: `false`
- **Description**: Open post-processed content in a new editor instead of copying to clipboard.

#### `numbers-le.openResultsSideBySide`

- **Type**: `boolean`
- **Default**: `false`
- **Description**: Open extraction results in a new editor to the side of the current editor.

### Safety and Performance

#### `numbers-le.safety.enabled`

- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable safety checks for large files and operations. When enabled, the extension will warn users before processing large files or generating large outputs.

#### `numbers-le.safety.fileSizeWarnBytes`

- **Type**: `number`
- **Default**: `1000000` (1 MB)
- **Minimum**: `1000`
- **Description**: Warn when input file size exceeds this threshold in bytes. Helps prevent processing of extremely large files that might cause performance issues.

#### `numbers-le.safety.largeOutputLinesThreshold`

- **Type**: `number`
- **Default**: `50000`
- **Minimum**: `100`
- **Description**: Warn before opening/copying when result lines exceed this threshold. Prevents clipboard failures and UI freezes with very large outputs.

#### `numbers-le.safety.manyDocumentsThreshold`

- **Type**: `number`
- **Default**: `8`
- **Minimum**: `1`
- **Description**: Warn before opening multiple result documents when count exceeds this threshold. Helps prevent workspace clutter.

### CSV Processing

#### `numbers-le.csv.streamingEnabled`

- **Type**: `boolean`
- **Default**: `false`
- **Description**: Stream CSV extraction incrementally into the editor. Useful for very large CSV files that might cause memory issues with standard processing.

### Error Handling

#### `numbers-le.showParseErrors`

- **Type**: `boolean`
- **Default**: `false`
- **Description**: Show parse errors as VS Code notifications when parsing fails. When disabled, errors are only logged to the Output panel.

### Telemetry

#### `numbers-le.telemetryEnabled`

- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable local-only telemetry logs to the Output panel. When enabled, usage statistics and performance metrics are logged locally for debugging purposes.

## Configuration Examples

### Basic Setup (Default)

```json
{
  "numbers-le.notificationsLevel": "silent",
  "numbers-le.statusBar.enabled": true,
  "numbers-le.analysis.enabled": true,
  "numbers-le.safety.enabled": true
}
```

### Power User Setup

```json
{
  "numbers-le.notificationsLevel": "all",
  "numbers-le.copyToClipboardEnabled": true,
  "numbers-le.dedupeEnabled": true,
  "numbers-le.sortEnabled": true,
  "numbers-le.sortMode": "numeric-asc",
  "numbers-le.analysis.includeStats": true,
  "numbers-le.telemetryEnabled": true
}
```

### Large File Processing

```json
{
  "numbers-le.safety.fileSizeWarnBytes": 5000000,
  "numbers-le.safety.largeOutputLinesThreshold": 100000,
  "numbers-le.csv.streamingEnabled": true,
  "numbers-le.openResultsSideBySide": true
}
```

### Minimal Setup

```json
{
  "numbers-le.notificationsLevel": "silent",
  "numbers-le.statusBar.enabled": false,
  "numbers-le.analysis.enabled": false,
  "numbers-le.safety.enabled": false
}
```

## Configuration Validation

Numbers-LE validates all configuration values and applies sensible defaults for invalid values:

- **Enum values**: Invalid enum values default to the first valid option
- **Numeric ranges**: Values below minimum thresholds are clamped to the minimum
- **Boolean values**: Non-boolean values are converted to boolean using standard JavaScript rules

## Workspace vs User Settings

- **User Settings**: Apply to all VS Code instances for the current user
- **Workspace Settings**: Apply only to the current workspace and override user settings
- **Folder Settings**: Apply only to files within a specific folder and override workspace settings

## Configuration Changes

Configuration changes are detected automatically and applied immediately without requiring extension restart. Some changes may require reloading the current editor to take effect.

## Troubleshooting Configuration

### Common Issues

1. **Settings not taking effect**: Try reloading the VS Code window (`Ctrl+Shift+P` → "Developer: Reload Window")
2. **Invalid configuration values**: Check the VS Code Problems panel for configuration errors
3. **Performance issues**: Consider reducing safety thresholds or disabling analysis for very large files

### Reset to Defaults

To reset all Numbers-LE settings to defaults:

1. Open VS Code Settings (`Ctrl+,`)
2. Search for "numbers-le"
3. Click the gear icon next to each setting
4. Select "Reset Setting"

Or manually remove all `numbers-le.*` entries from your `settings.json` file.
