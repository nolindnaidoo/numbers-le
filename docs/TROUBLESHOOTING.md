# Numbers-LE Troubleshooting

## Quick Fixes

### Extension Not Working

- **Symptom**: Commands not available, status bar not showing
- **Fix**: Reload VS Code window (`Ctrl+Shift+P` → "Developer: Reload Window")

### No Numbers Found

- **Symptom**: "No numbers found in the file" message
- **Fix**: Ensure file contains numeric values in supported formats

### Parse Errors

- **Symptom**: "Failed to extract numbers" with error message
- **Fix**: Check file syntax and format validity

### Performance Issues

- **Symptom**: Slow processing, memory warnings
- **Fix**: Enable CSV streaming, reduce file size, or adjust safety thresholds

## Common Issues

### 1. Extension Activation Problems

#### Symptoms

- Commands not appearing in Command Palette
- Status bar entry not visible
- Context menu options missing

#### Causes

- Extension not properly activated
- VS Code version incompatibility
- Conflicting extensions

#### Solutions

1. **Check Extension Status**

   - Open Extensions view (`Ctrl+Shift+X`)
   - Search for "Numbers-LE"
   - Ensure it's enabled and not disabled

2. **Reload Window**

   - `Ctrl+Shift+P` → "Developer: Reload Window"
   - This reinitializes the extension

3. **Check VS Code Version**

   - Numbers-LE requires VS Code 1.105.0 or higher
   - Update VS Code if necessary

4. **Check for Conflicts**
   - Temporarily disable other number-related extensions
   - Test if Numbers-LE works in isolation

### 2. File Format Issues

#### Symptoms

- "Unsupported file type" error
- Parse errors for valid files
- Incorrect number extraction

#### Causes

- File extension not recognized
- Malformed file content
- Encoding issues

#### Solutions

1. **Check File Extension**

   - Ensure file has correct extension (`.json`, `.yaml`, `.csv`, etc.)
   - Rename file if necessary

2. **Validate File Content**

   - Use online validators for JSON, YAML, etc.
   - Check for syntax errors
   - Ensure proper encoding (UTF-8)

3. **Test with Sample Data**

   - Create a simple test file with known numbers
   - Verify extraction works with test data

4. **Check File Encoding**
   - Ensure file is saved as UTF-8
   - Avoid BOM (Byte Order Mark) if possible

### 3. Performance Problems

#### Symptoms

- Slow processing of large files
- Memory usage warnings
- VS Code becomes unresponsive
- Safety warnings appear

#### Causes

- Very large files (>1MB)
- Complex nested structures
- Insufficient system memory
- Safety thresholds too low

#### Solutions

1. **Enable CSV Streaming**

   - Set `numbers-le.csv.streamingEnabled` to `true`
   - Reduces memory usage for large CSV files

2. **Adjust Safety Thresholds**

   - Increase `numbers-le.safety.fileSizeWarnBytes`
   - Increase `numbers-le.safety.largeOutputLinesThreshold`
   - Disable `numbers-le.safety.enabled` if needed

3. **Optimize File Size**

   - Split large files into smaller chunks
   - Remove unnecessary data
   - Use more efficient formats

4. **System Resources**
   - Close other applications
   - Increase available RAM
   - Use SSD storage for better performance

### 4. Configuration Issues

#### Symptoms

- Settings not taking effect
- Unexpected behavior
- Configuration errors in Problems panel

#### Causes

- Invalid configuration values
- Conflicting settings
- Corrupted settings file

#### Solutions

1. **Validate Configuration**

   - Check VS Code Problems panel (`Ctrl+Shift+M`)
   - Look for configuration errors
   - Fix invalid values

2. **Reset Settings**

   - Open Settings (`Ctrl+,`)
   - Search for "numbers-le"
   - Reset individual settings to defaults

3. **Check Settings Hierarchy**

   - User settings override workspace settings
   - Folder settings override workspace settings
   - Check for conflicting values

4. **Manual Settings Edit**
   - Open `settings.json`
   - Remove invalid `numbers-le.*` entries
   - Restart VS Code

### 5. Error Handling Issues

#### Symptoms

- Silent failures
- Unhelpful error messages
- Extension crashes

#### Causes

- Disabled error reporting
- Corrupted extension files
- System-level issues

#### Solutions

1. **Enable Error Reporting**

   - Set `numbers-le.showParseErrors` to `true`
   - Set `numbers-le.telemetryEnabled` to `true`
   - Check Output panel for detailed errors

2. **Check Extension Logs**

   - Open Output panel (`Ctrl+Shift+U`)
   - Select "Numbers-LE" from dropdown
   - Look for error messages

3. **Reinstall Extension**

   - Uninstall Numbers-LE
   - Restart VS Code
   - Reinstall from Marketplace

4. **System Diagnostics**
   - Check VS Code Developer Tools (`Ctrl+Shift+I`)
   - Look for JavaScript errors
   - Check system event logs

## Advanced Troubleshooting

### Debug Mode

Enable debug mode for detailed logging:

1. Open Settings (`Ctrl+,`)
2. Search for "numbers-le"
3. Set `numbers-le.telemetryEnabled` to `true`
4. Set `numbers-le.notificationsLevel` to `"all"`
5. Check Output panel for detailed logs

### Performance Profiling

Monitor extension performance:

1. Open Developer Tools (`Ctrl+Shift+I`)
2. Go to Performance tab
3. Record a session while using Numbers-LE
4. Analyze performance bottlenecks

### Memory Analysis

Check memory usage:

1. Open Developer Tools (`Ctrl+Shift+I`)
2. Go to Memory tab
3. Take heap snapshots
4. Compare before/after using Numbers-LE

### Network Issues

Check for network-related problems:

1. Open Developer Tools (`Ctrl+Shift+I`)
2. Go to Network tab
3. Monitor requests during extension use
4. Look for failed requests or timeouts

## File-Specific Issues

### JSON Files

- **Invalid JSON**: Use JSON validator
- **Large files**: Consider streaming or chunking
- **Nested structures**: Check for circular references

### YAML Files

- **Indentation**: Ensure consistent indentation
- **Special characters**: Escape special characters properly
- **Large files**: Consider using YAML streaming libraries

### CSV Files

- **Delimiter issues**: Check for consistent delimiters
- **Encoding problems**: Ensure UTF-8 encoding
- **Large files**: Enable streaming mode

### TOML Files

- **Syntax errors**: Validate TOML syntax
- **Nested tables**: Check table structure
- **Data types**: Ensure proper data type formatting

### INI Files

- **Section headers**: Check section formatting
- **Key-value pairs**: Ensure proper key=value format
- **Comments**: Remove or properly format comments

### ENV Files

- **Variable format**: Ensure KEY=VALUE format
- **Quoting**: Check for proper quoting of values
- **Special characters**: Escape special characters

## Getting Help

### Self-Service Resources

1. **Documentation**: Check all documentation files
2. **GitHub Issues**: Search existing issues
3. **VS Code Marketplace**: Check extension page for updates

### Community Support

1. **GitHub Discussions**: Ask questions and share solutions
2. **VS Code Community**: Post in VS Code community forums
3. **Stack Overflow**: Tag questions with `vscode-extension`

### Reporting Issues

When reporting issues, include:

1. **VS Code Version**: `Help` → `About`
2. **Extension Version**: Check in Extensions view
3. **Operating System**: Windows, macOS, or Linux version
4. **Reproduction Steps**: Detailed steps to reproduce
5. **Expected vs Actual**: What you expected vs what happened
6. **Error Messages**: Copy exact error messages
7. **Sample Files**: Provide sample files that cause issues

### Contact Information

- **GitHub Repository**: [nolindnaidoo/numbers-le](https://github.com/nolindnaidoo/numbers-le)
- **Issues**: [GitHub Issues](https://github.com/nolindnaidoo/numbers-le/issues)
- **Discussions**: [GitHub Discussions](https://github.com/nolindnaidoo/numbers-le/discussions)

## Prevention

### Best Practices

1. **Regular Updates**: Keep VS Code and extensions updated
2. **Backup Settings**: Export VS Code settings regularly
3. **Test Files**: Use known good test files for validation
4. **Monitor Performance**: Watch for performance degradation
5. **Clean Workspace**: Remove unnecessary files and extensions

### Maintenance

1. **Clear Cache**: Clear VS Code cache periodically
2. **Restart Regularly**: Restart VS Code to free memory
3. **Update Dependencies**: Keep system dependencies updated
4. **Monitor Logs**: Check extension logs for issues
5. **Clean Configuration**: Remove unused settings

### System Requirements

- **VS Code**: 1.105.0 or higher
- **Node.js**: 20.0.0 or higher (for development)
- **Memory**: 4GB RAM minimum, 8GB recommended
- **Storage**: 100MB free space for extension and cache
- **Operating System**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 18.04+)
