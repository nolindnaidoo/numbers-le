# Numbers-LE Privacy Policy

## Privacy Commitment

Numbers-LE is committed to protecting your privacy and ensuring that your data remains secure and private. This extension operates entirely locally on your machine and does not collect, store, or transmit any personal data or file contents to external servers.

## Data Processing

### Local Processing Only

- **All processing happens locally**: Numbers-LE processes all data entirely on your local machine
- **No network requests**: The extension does not make any network requests or send data to external servers
- **No cloud processing**: All number extraction and analysis occurs locally using your device's resources

### Data Types Processed

Numbers-LE processes the following types of data:

- **File contents**: Only the files you explicitly open in VS Code
- **Extracted numbers**: Numeric values found within your files
- **Statistical analysis**: Calculations performed on extracted numbers
- **Configuration settings**: Your extension preferences and settings

### Data Storage

- **No persistent storage**: Numbers-LE does not store your file contents or extracted data
- **Temporary processing**: Data exists only in memory during processing
- **VS Code settings**: Only your configuration preferences are stored in VS Code's settings

## Telemetry and Logging

### Optional Telemetry

Numbers-LE includes optional telemetry that you can enable or disable:

```json
{
  "numbers-le.telemetryEnabled": false
}
```

### What Telemetry Collects (When Enabled)

When telemetry is enabled, the following information is logged locally to VS Code's Output panel:

- **Operation events**: Commands executed (extract, analyze, sort, etc.)
- **Performance metrics**: Processing time, memory usage, file sizes
- **Error information**: Error types and categories (sanitized)
- **Usage statistics**: Feature usage frequency and patterns

### What Telemetry Does NOT Collect

- **File contents**: Never logs actual file data or extracted numbers
- **Personal information**: No names, emails, or identifying information
- **File paths**: Only file types and sizes, not actual file locations
- **Network data**: No network requests or external communication

### Telemetry Data Location

- **Local only**: All telemetry data is stored locally in VS Code's Output panel
- **No transmission**: Telemetry data is never sent to external servers
- **User control**: You can disable telemetry at any time
- **Data retention**: Telemetry data is only kept in VS Code's local logs

## Data Security

### Input Validation

Numbers-LE implements comprehensive input validation to protect against malicious data:

- **File type validation**: Only processes supported file formats
- **Size limits**: Implements safety limits for file processing
- **Content sanitization**: Sanitizes error messages to remove sensitive information
- **Path validation**: Prevents path traversal attacks

### Error Handling

- **Sanitized errors**: Error messages are sanitized to remove sensitive information
- **Local logging**: Errors are only logged locally, never transmitted
- **No sensitive data**: Error logs do not contain file contents or personal information

### Memory Management

- **Immediate cleanup**: Data is cleared from memory immediately after processing
- **No persistent storage**: No data is stored on disk beyond VS Code settings
- **Memory limits**: Implements safety limits to prevent memory issues

## Third-Party Dependencies

### Dependency Audit

Numbers-LE uses only essential, well-audited dependencies:

- **JSON parsing**: Native JavaScript `JSON.parse()`
- **YAML parsing**: `js-yaml` library (local processing only)
- **CSV parsing**: `csv-parse` library (local processing only)
- **TOML parsing**: `@iarna/toml` library (local processing only)
- **INI parsing**: `ini` library (local processing only)

### Dependency Security

- **Regular updates**: Dependencies are regularly updated for security patches
- **Minimal dependencies**: Only essential libraries are included
- **Local processing**: All dependencies operate locally only
- **No network access**: Dependencies do not make network requests

## User Control

### Privacy Settings

You have complete control over privacy-related features:

```json
{
  "numbers-le.telemetryEnabled": false,
  "numbers-le.showParseErrors": false,
  "numbers-le.notificationsLevel": "silent"
}
```

### Data Control

- **Delete settings**: You can remove all Numbers-LE settings from VS Code
- **Disable extension**: You can disable the extension at any time
- **Uninstall**: You can uninstall the extension completely
- **No data retention**: No data is retained after uninstallation

### Transparency

- **Open source**: Numbers-LE is open source and its code is publicly available
- **Code review**: All code is publicly auditable
- **No hidden features**: All functionality is documented and transparent
- **User inspection**: You can inspect all code and functionality

## Compliance

### Data Protection Regulations

Numbers-LE is designed to comply with data protection regulations:

- **GDPR compliance**: No personal data collection or processing
- **CCPA compliance**: No sale or sharing of personal information
- **Local processing**: All processing occurs locally on your device
- **User consent**: Clear opt-in for any optional features

### Privacy by Design

- **Minimal data**: Only processes data necessary for functionality
- **Local processing**: No external data transmission
- **User control**: Complete user control over all features
- **Transparency**: Clear documentation of all data handling

## Data Retention

### No Data Retention

Numbers-LE does not retain any data:

- **No persistent storage**: No data is stored on disk
- **Memory only**: Data exists only in memory during processing
- **Immediate cleanup**: Data is cleared immediately after processing
- **No backups**: No data is backed up or archived

### Settings Retention

Only your configuration settings are retained by VS Code:

- **VS Code settings**: Stored in VS Code's settings system
- **User control**: You can delete these settings at any time
- **Local storage**: Settings are stored locally on your machine
- **No transmission**: Settings are never transmitted externally

## Security Measures

### Code Security

- **Input validation**: All inputs are validated and sanitized
- **Error handling**: Comprehensive error handling prevents data leaks
- **Memory safety**: Proper memory management prevents leaks
- **Type safety**: TypeScript provides compile-time safety

### Runtime Security

- **Sandboxed execution**: Runs within VS Code's sandboxed environment
- **No network access**: No network requests or external communication
- **Local permissions**: Only accesses local files you explicitly open
- **User consent**: All actions require explicit user interaction

## Contact and Support

### Privacy Questions

If you have questions about privacy or data handling:

- **GitHub Issues**: Open an issue on the GitHub repository
- **GitHub Discussions**: Use GitHub Discussions for questions
- **Email**: Contact the maintainer directly
- **Documentation**: Check this privacy policy and other documentation

### Privacy Concerns

If you have concerns about privacy or data handling:

- **Report issues**: Use GitHub Issues to report concerns
- **Request changes**: Suggest improvements to privacy practices
- **Audit requests**: Request code audits or privacy reviews
- **Transparency**: All privacy practices are documented and auditable

## Policy Updates

### Notification of Changes

- **GitHub releases**: Privacy policy updates are included in release notes
- **Documentation updates**: Changes are documented in the privacy policy
- **Version control**: All changes are tracked in version control
- **User notification**: Significant changes are announced in releases

### Policy Versioning

- **Version control**: Privacy policy is versioned with the extension
- **Change tracking**: All changes are tracked and documented
- **Historical versions**: Previous versions are available in version control
- **Transparency**: All changes are publicly visible and auditable

## Summary

Numbers-LE is designed with privacy as a core principle:

- **No data collection**: No personal data or file contents are collected
- **Local processing**: All processing happens locally on your machine
- **No network access**: No data is transmitted to external servers
- **User control**: Complete control over all privacy-related features
- **Transparency**: All code and practices are publicly auditable
- **Compliance**: Designed to comply with data protection regulations

Your privacy and data security are our top priorities. Numbers-LE operates entirely locally and gives you complete control over your data and privacy settings.
