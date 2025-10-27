# Changelog

All notable changes to Numbers-LE will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.8.0] - 2025-10-26

### Security & Enterprise Readiness

- **CSV Injection Prevention** - Added comprehensive security tests covering:
  - Formula injection (`=`, `+`, `-`, `@` prefixes)
  - Command injection (DDE attacks)
  - SQL injection patterns
  - XSS injection vectors
  - Path traversal in CSV data
  - Null byte injection
  - Long line DoS prevention
- **ENV/INI Injection Prevention** - Added security tests for:
  - Command injection in environment values
  - Shell expansion attacks (`$()`, backticks)
  - Variable expansion exploitation
  - Newline and null byte injection
  - Export statement abuse
  - Multiline value attacks
- **Test Suite Expansion** - Increased from 129 to 171 unit tests (+33%)
  - 95% function coverage, 80% line coverage
  - Zero critical vulnerabilities
  - Enterprise-grade reliability

### Quality Improvements

- **Type Safety** - 100% TypeScript strict mode compliance
- **Immutability** - All exports frozen with `Object.freeze()`
- **Dependency Security** - Zero vulnerabilities in dependency chain

## [1.7.0] - 2025-01-27

### Initial Public Release

Numbers-LE brings zero-hassle number extraction to VS Code. Simple, reliable, focused.

#### Supported File Types

- **JSON** - API responses and configuration files
- **YAML** - Configuration and data files
- **CSV** - Data exports and analysis files
- **TOML** - Configuration files
- **INI** - Configuration files
- **ENV** - Environment files

#### Features

- **Multi-language support** - Comprehensive localization for 12+ languages
- **Intelligent number detection** - Identifies true numeric values (integers, floats, percentages, currencies)
- **Smart filtering** - Filters out IDs, version numbers, and non-data noise
- **Statistical analysis built-in**:
  - **Basic stats** - count, sum, average, min, max, median, mode
  - **Advanced analysis** - range, variance, standard deviation
  - **Data insights** - outliers, trends, patterns
- **Automatic cleanup**:
  - **Sort** for stable analysis and reviews
  - **Dedupe** to eliminate noise
  - **Filter** by ranges or conditions
- **Stream processing** - Work with millions of rows without locking VS Code
- **High-performance** - Efficiently processes large datasets
- **One-command extraction** - `Ctrl+Alt+N` (`Cmd+Alt+N` on macOS)
- **Developer-friendly** - 129 passing tests (95.24% function coverage, 80.06% line coverage), TypeScript strict mode, functional programming, MIT licensed

#### Use Cases

- **Financial Analysis** - Extract revenue, profit, and growth metrics from JSON/CSV for quick validation
- **Config Validation** - Pull timeouts, limits, and thresholds from YAML/TOML/INI for auditing
- **Performance Monitoring** - Analyze CPU, memory, and response times from logs and metrics files
- **Data QA** - Get instant statistics (avg, median, outliers) on numeric datasets
