# Numbers-LE Commands

## Overview

Numbers-LE provides a comprehensive set of commands for extracting, analyzing, and processing numbers from various file formats. All commands are available through the Command Palette (`Ctrl+Shift+P`) and can be assigned custom keybindings.

## Core Commands

### `numbers-le.extractNumbers`

- **Title**: Extract Numbers
- **Category**: Numbers-LE
- **Keybinding**: `Ctrl+Alt+N` (Windows/Linux), `Cmd+Alt+N` (macOS)
- **Context Menu**: Available for supported file types

**Description**: Main command for extracting numbers from the currently active editor. Supports JSON, YAML, CSV, TOML, INI, and ENV files.

**Behavior**:

1. Detects file type based on file extension
2. Extracts all numeric values from the file
3. Applies post-processing (deduplication, sorting) if enabled
4. Performs statistical analysis if enabled
5. Displays results based on configuration

**Preconditions**:

- Active text editor must be open
- File must be a supported format
- File must contain parseable content

**Outputs**:

- Extracted numbers list
- Statistical analysis (if enabled)
- Results copied to clipboard or opened in new editor

**Related Settings**:

- `numbers-le.copyToClipboardEnabled`
- `numbers-le.dedupeEnabled`
- `numbers-le.sortEnabled`
- `numbers-le.sortMode`
- `numbers-le.analysis.enabled`
- `numbers-le.openResultsSideBySide`

**Expected Warnings/Errors**:

- "No active editor found" - No editor is currently active
- "Failed to extract numbers" - File parsing failed
- "No numbers found in the file" - No numeric values detected
- Safety warnings for large files or outputs

### `numbers-le.postProcess.dedupe`

- **Title**: Deduplicate Numbers
- **Category**: Numbers-LE

**Description**: Deduplicates numbers from the currently active editor, removing duplicate values while preserving order.

**Behavior**:

1. Extracts numbers from the active editor
2. Removes duplicate values
3. Preserves order of first occurrence
4. Displays deduplication statistics
5. Copies results to clipboard

**Preconditions**:

- Active text editor must be open
- File must contain extractable numbers

**Outputs**:

- Deduplicated numbers list
- Statistics showing original count, final count, and duplicates removed

**Related Settings**:

- `numbers-le.copyToClipboardEnabled`

**Expected Warnings/Errors**:

- "No active editor found" - No editor is currently active
- "No numbers found in the file" - No numeric values detected
- "No duplicate numbers found" - All numbers are already unique

### `numbers-le.postProcess.sort`

- **Title**: Sort Numbers
- **Category**: Numbers-LE

**Description**: Sorts numbers from the currently active editor using a user-selected sorting method.

**Behavior**:

1. Extracts numbers from the active editor
2. Presents sorting options to the user
3. Applies selected sorting method
4. Displays sorted results
5. Copies results to clipboard

**Preconditions**:

- Active text editor must be open
- File must contain extractable numbers
- User must select a sorting method

**Outputs**:

- Sorted numbers list
- Confirmation of sorting method applied

**Related Settings**:

- `numbers-le.copyToClipboardEnabled`

**Expected Warnings/Errors**:

- "No active editor found" - No editor is currently active
- "No numbers found in the file" - No numeric values detected

### `numbers-le.postProcess.analyze`

- **Title**: Analyze Numbers
- **Category**: Numbers-LE

**Description**: Performs comprehensive statistical analysis on numbers from the currently active editor.

**Behavior**:

1. Extracts numbers from the active editor
2. Calculates basic statistics (count, sum, average, median, mode, min, max, range)
3. Calculates advanced statistics (standard deviation, variance)
4. Detects outliers using IQR method
5. Generates detailed analysis report
6. Copies report to clipboard

**Preconditions**:

- Active text editor must be open
- File must contain extractable numbers
- At least 4 numbers required for outlier detection

**Outputs**:

- Comprehensive analysis report
- Basic and advanced statistics
- Outlier detection results

**Related Settings**:

- `numbers-le.copyToClipboardEnabled`

**Expected Warnings/Errors**:

- "No active editor found" - No editor is currently active
- "No numbers found in the file" - No numeric values detected

## Utility Commands

### `numbers-le.csv.toggleStreaming`

- **Title**: Toggle CSV Streaming
- **Category**: Numbers-LE

**Description**: Toggles CSV streaming mode on/off. When enabled, large CSV files are processed incrementally to reduce memory usage.

**Behavior**:

1. Toggles the `numbers-le.csv.streamingEnabled` setting
2. Shows confirmation message
3. Updates status bar display

**Preconditions**:

- None

**Outputs**:

- Confirmation message
- Status bar update

**Related Settings**:

- `numbers-le.csv.streamingEnabled`

**Expected Warnings/Errors**:

- None

### `numbers-le.openSettings`

- **Title**: Open Settings
- **Category**: Numbers-LE

**Description**: Opens VS Code settings filtered to Numbers-LE configuration options.

**Behavior**:

1. Opens VS Code settings UI
2. Filters to show only Numbers-LE settings
3. Logs command usage

**Preconditions**:

- None

**Outputs**:

- VS Code settings UI opened

**Related Settings**:

- All Numbers-LE settings

**Expected Warnings/Errors**:

- None

### `numbers-le.help`

- **Title**: Help & Troubleshooting
- **Category**: Numbers-LE

**Description**: Shows help information and troubleshooting tips for Numbers-LE.

**Behavior**:

1. Opens help document in VS Code
2. Provides troubleshooting information
3. Shows links to documentation

**Preconditions**:

- None

**Outputs**:

- Help document displayed

**Related Settings**:

- None

**Expected Warnings/Errors**:

- None

## Context Menu Integration

Numbers-LE commands are available in the editor context menu for supported file types:

- **JSON files** (`.json`)
- **YAML files** (`.yaml`, `.yml`)
- **CSV files** (`.csv`)
- **TOML files** (`.toml`)
- **INI files** (`.ini`)
- **ENV files** (`.env`)

Right-click in the editor to access Numbers-LE commands.

## Keybindings

### Default Keybindings

- `Ctrl+Alt+N` (Windows/Linux) / `Cmd+Alt+N` (macOS): Extract Numbers

### Custom Keybindings

You can assign custom keybindings to any Numbers-LE command by:

1. Opening Keyboard Shortcuts (`Ctrl+K Ctrl+S`)
2. Searching for "numbers-le"
3. Clicking the pencil icon next to the command
4. Pressing your desired key combination

### Recommended Keybindings

- `Ctrl+Alt+D`: Deduplicate Numbers
- `Ctrl+Alt+S`: Sort Numbers
- `Ctrl+Alt+A`: Analyze Numbers
- `Ctrl+Alt+T`: Toggle CSV Streaming

## Command Palette Integration

All Numbers-LE commands are available in the Command Palette:

1. Open Command Palette (`Ctrl+Shift+P`)
2. Type "Numbers-LE" or "numbers-le"
3. Select the desired command

## Error Handling

### Common Error Scenarios

1. **No Active Editor**

   - **Error**: "No active editor found"
   - **Solution**: Open a file in the editor before running the command

2. **Unsupported File Type**

   - **Error**: "Unsupported file type"
   - **Solution**: Use a supported file format (JSON, YAML, CSV, TOML, INI, ENV)

3. **Parse Errors**

   - **Error**: "Failed to extract numbers: [error message]"
   - **Solution**: Check file syntax and format

4. **No Numbers Found**

   - **Error**: "No numbers found in the file"
   - **Solution**: Ensure the file contains numeric values

5. **Large File Warnings**
   - **Warning**: Safety warnings for large files
   - **Solution**: Consider using CSV streaming or reducing file size

### Error Recovery

Numbers-LE provides automatic error recovery where possible:

- **Retry**: For transient failures
- **Fallback**: Alternative processing methods
- **User Action**: Manual intervention required

## Performance Considerations

### Large Files

- Files > 1MB may trigger safety warnings
- Consider enabling CSV streaming for large CSV files
- Use side-by-side view for large outputs

### Memory Usage

- Monitor memory usage for very large datasets
- Consider processing files in smaller chunks
- Use deduplication to reduce memory footprint

### Processing Time

- Operations > 5 seconds may trigger warnings
- Consider optimizing data before processing
- Use sorting and deduplication judiciously

## Troubleshooting

### Command Not Available

1. Check if the file type is supported
2. Ensure the extension is activated
3. Try reloading the VS Code window

### Command Fails

1. Check the Output panel for detailed error messages
2. Verify file syntax and format
3. Try with a smaller test file

### Performance Issues

1. Check safety settings and thresholds
2. Consider disabling analysis for large files
3. Use streaming mode for CSV files

### Unexpected Results

1. Verify file format and syntax
2. Check configuration settings
3. Try with a known good test file
