# Numbers-LE Development Guide

## Prerequisites

- **Node.js**: 20.0.0 or higher
- **VS Code**: 1.105.0 or higher
- **Git**: For version control
- **Bun**: For package management

## Local Setup

### 1. Clone Repository

```bash
git clone https://github.com/nolindnaidoo/numbers-le.git
cd numbers-le
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Build Extension

```bash
bun run build
```

### 4. Run Tests

```bash
bun test
```

### 5. Package Extension

```bash
bun run package
```

## Development Workflow

### 1. Make Changes

- Edit source files in `src/`
- Follow TypeScript best practices
- Use functional programming patterns
- Maintain immutability with `Object.freeze()`

### 2. Test Changes

```bash
# Run all tests
bun test

# Run tests with coverage
bun run test:coverage

# Run performance tests
bun run test:performance
```

### 3. Build and Test

```bash
# Build TypeScript
bun run build

# Lint code
bun run lint

# Fix linting issues
bun run lint --write
```

### 4. Package and Test Extension

```bash
# Package extension
bun run package

# Install in VS Code for testing
code --install-extension release/numbers-le-1.0.0.vsix
```

## Project Structure

```
numbers-le/
├── src/                    # Source code
│   ├── commands/          # Command implementations
│   ├── config/            # Configuration management
│   ├── extraction/        # Number extraction logic
│   │   ├── formats/       # Format-specific parsers
│   │   └── __data__/      # Test data files
│   ├── ui/                # User interface components
│   ├── utils/             # Utility functions
│   ├── telemetry/         # Telemetry and logging
│   ├── extension.ts       # Extension entry point
│   └── types.ts           # Type definitions
├── docs/                  # Documentation
├── dist/                  # Compiled JavaScript
├── release/               # Packaged extensions
├── package.json           # Package configuration
├── tsconfig.json          # TypeScript configuration
├── biome.json             # Linting configuration
└── README.md              # Project documentation
```

## Code Style

### TypeScript Standards

- Use strict TypeScript configuration
- Prefer `readonly` types and `Object.freeze()` for immutability
- Use factory functions over classes
- Write pure functions with explicit return type annotations
- Enable `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`

### Functional Programming

- Prefer pure functions over impure ones
- Use immutable data structures
- Avoid side effects in utility functions
- Use dependency injection for testability

### Code Organization

- Keep `src/extension.ts` minimal - only register commands/providers
- Organize by feature: commands/, config/, ui/, utils/
- Separate core logic from VS Code API surface
- Use centralized type definitions in `types.ts`

### Error Handling

- Use centralized error handling patterns
- Categorize errors by type and severity
- Provide user-friendly error messages
- Include recovery options where possible

## Testing

### Test Structure

- Unit tests for pure functions
- Integration tests for command flow
- Performance tests for large datasets
- Mock VS Code API for isolated testing

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test src/utils/analysis.test.ts

# Run tests with coverage
bun run test:coverage

# Run performance tests
bun run test:performance
```

### Test Data

- Use realistic test data in `src/extraction/__data__/`
- Include edge cases and error scenarios
- Test with various file sizes and formats
- Validate against expected outputs

### Mocking

- Mock VS Code API using `src/__mocks__/vscode.ts`
- Mock external dependencies
- Use dependency injection for testability
- Isolate components for unit testing

## Debugging

### VS Code Debugging

1. Open VS Code in the project directory
2. Set breakpoints in source code
3. Press `F5` to start debugging
4. Use Debug Console for inspection

### Extension Debugging

1. Build extension: `bun run build`
2. Package extension: `bun run package`
3. Install in VS Code: `code --install-extension release/numbers-le-1.0.0.vsix`
4. Open Developer Tools: `Ctrl+Shift+I`
5. Check Console for errors

### Performance Debugging

1. Enable telemetry: `numbers-le.telemetryEnabled = true`
2. Check Output panel for performance logs
3. Use VS Code Developer Tools Performance tab
4. Monitor memory usage in Memory tab

## Building

### Development Build

```bash
# Build TypeScript
bun run build

# Watch for changes
bun run watch
```

### Production Build

```bash
# Clean previous builds
bun run clean

# Build extension
bun run build

# Copy localization files
bun run copy:i18n

# Package extension
bun run package
```

### Build Configuration

- TypeScript target: ES2020
- Module system: CommonJS
- Output directory: `dist/`
- Source maps: Enabled for debugging

## Packaging

### VSIX Package

```bash
# Package extension
bun run package

# List package contents
bun run package:ls
```

### Package Contents

- Compiled JavaScript files
- TypeScript source maps
- Localization files
- Package manifest
- README and LICENSE

### Package Validation

- Check package size (< 50MB)
- Validate manifest syntax
- Test installation in VS Code
- Verify all dependencies included

## Publishing

### Marketplace Publishing

```bash
# Publish to VS Code Marketplace
bun run publish
```

### Open VSX Publishing

```bash
# Install Open VSX CLI
bun install -g ovsx

# Login to Open VSX
ovsx login <namespace>

# Publish to Open VSX
ovsx publish release/numbers-le-1.0.0.vsix
```

### Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Build and test extension
4. Package extension
5. Create GitHub release
6. Publish to marketplaces

## Localization

### Adding New Strings

1. Add string to `src/i18n/package.nls.json`
2. Use `manifest.*` prefix for manifest strings
3. Use `runtime.*` prefix for runtime strings
4. Update all language files

### Localization Files

- `package.nls.json` - Base English strings
- `package.nls.{locale}.json` - Translations
- Copy to root during build process

### String Formatting

- Use `vscode-nls` for localization
- Support parameter substitution: `{0}`, `{1}`, etc.
- Use MessageFormat for complex formatting
- Provide fallback English strings

## Performance

### Optimization Strategies

- Use streaming for large files
- Implement caching for repeated operations
- Debounce user input
- Limit memory usage with size thresholds
- Use efficient data structures

### Performance Monitoring

- Track operation duration
- Monitor memory usage
- Log performance metrics
- Set performance budgets
- Alert on performance degradation

### Large File Handling

- Implement streaming parsers
- Use chunked processing
- Provide progress indicators
- Set safety limits
- Offer alternative processing methods

## Security

### Input Validation

- Validate file types and extensions
- Check file size limits
- Sanitize error messages
- Prevent path traversal
- Validate configuration values

### Data Privacy

- Process data locally only
- No network requests
- Sanitize logs
- User control over telemetry
- Clear data handling policies

### Error Handling

- Sanitize error messages
- Remove sensitive information
- Log errors locally only
- Provide recovery options
- Graceful degradation

## Contributing

### Code Contributions

1. Fork the repository
2. Create a feature branch
3. Make changes following code style
4. Add tests for new functionality
5. Update documentation
6. Submit a pull request

### Pull Request Process

1. Ensure all tests pass
2. Update documentation
3. Add changelog entry
4. Request code review
5. Address feedback
6. Merge after approval

### Issue Reporting

1. Check existing issues
2. Provide reproduction steps
3. Include system information
4. Attach sample files
5. Describe expected vs actual behavior

## Maintenance

### Regular Tasks

- Update dependencies
- Run security audits
- Update documentation
- Review and merge PRs
- Monitor issue reports

### Dependency Updates

```bash
# Check for updates
bun outdated

# Update dependencies
bun update

# Audit security
bun audit

# Fix vulnerabilities
bun audit --fix
```

### Code Quality

- Run linting regularly
- Fix code style issues
- Update type definitions
- Refactor for maintainability
- Remove dead code

## Troubleshooting

### Common Issues

- Build failures: Check TypeScript errors
- Test failures: Verify test data and mocks
- Packaging issues: Check manifest syntax
- Performance problems: Monitor memory usage
- Localization issues: Verify string keys

### Debug Tools

- VS Code Developer Tools
- TypeScript compiler
- Node.js debugger
- Performance profiler
- Memory analyzer

### Getting Help

- Check documentation
- Search GitHub issues
- Ask in discussions
- Contact maintainers
- Join community forums
