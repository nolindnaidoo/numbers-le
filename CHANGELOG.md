# Changelog

All notable changes to the "Numbers-LE" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.1] - 2025-01-27

### Changed

- **Documentation update** - Updated README to reflect comprehensive multi-language support with 13 languages
- **User experience** - Enhanced README language support section with flag emojis and native descriptions

### Technical

- Updated README to accurately document existing multi-language capabilities
- Maintained 100% backward compatibility with existing installations

## [1.4.0] - 2025-01-27

### Added

- **Multi-language support achievement** - Added comprehensive localization for 12 additional languages
- **German (de)** - Vollständige deutsche Lokalisierung für alle Benutzeroberflächen-Elemente
- **Spanish (es)** - Soporte completo en español para comandos, configuraciones y mensajes
- **French (fr)** - Localisation française complète pour l'interface utilisateur
- **Indonesian (id)** - Dukungan bahasa Indonesia lengkap untuk semua fitur
- **Italian (it)** - Localizzazione italiana completa per comandi e impostazioni
- **Japanese (ja)** - コマンド、設定、メッセージの完全な日本語サポート
- **Korean (ko)** - 모든 사용자 인터페이스 요소에 대한 완전한 한국어 지원
- **Portuguese (Brazil) (pt-br)** - Suporte completo em português brasileiro
- **Russian (ru)** - Полная локализация на русском языке для всех элементов интерфейса
- **Ukrainian (uk)** - Повна локалізація українською мовою для всіх елементів інтерфейсу
- **Vietnamese (vi)** - Hỗ trợ tiếng Việt đầy đủ cho tất cả các tính năng
- **Chinese Simplified (zh-cn)** - 简体中文完整支持，包括命令、设置和消息

### Changed

- **Internationalization infrastructure** - Implemented vscode-nls with MessageFormat.file for robust localization
- **User experience** - All commands, settings, and notifications now adapt to user's VS Code language preference
- **Documentation** - Updated README to reflect multi-language support capabilities
- **Marketplace discoverability** - Enhanced with localized descriptions and keywords

### Technical

- Created comprehensive localization files for 12 languages with 73+ translated strings each
- Implemented proper i18n patterns following VS Code extension best practices
- All existing functionality works seamlessly across all supported languages
- Maintained 100% backward compatibility with English-only installations
- Localization covers: commands, settings, notifications, error messages, and help content

## [1.1.0] - 2025-10-14

### Added

- **Command parity achievement** - Full parity with other LE extraction extensions
- **Comprehensive documentation** - Added complete command list to README with examples
- **Documentation updates** - Updated all docs to reflect command parity achievement

### Changed

- **Default workflow** - All result-producing commands now open to the side by default for better workflow
  - Extract: Opens results beside source automatically
  - Dedupe: Opens deduplicated results beside original
  - Sort: Opens sorted results beside original
  - Help: Opens documentation beside code
- **Settings defaults** - Changed `openResultsSideBySide` and `postProcess.openInNewFile` defaults from `false` to `true`
- **Documentation** - Updated README to use new demo.gif
- **Infrastructure verification** - Verified activation events, command registry, and all infrastructure components
- **Command count** - Stabilized at 6 commands (Extract, Dedupe, Sort, CSV Toggle, Settings, Help)
- **Simplified workflow** - Streamlined post-processing to focus on core operations

### Removed

- **Analyze command** - Removed unused `numbers-le.postProcess.analyze` command and statistical analysis utilities

## [1.0.2] - 2025-10-14

### Fixed

- **VSCode engine version requirement** - Changed from `^1.105.0` to `^1.70.0` for better compatibility with current VSCode versions

## [1.0.1] - 2025-10-14

### Documentation

- Fixed test coverage section to show accurate 36.58% overall coverage instead of misleading "100% unit coverage" claim
- Added transparency about actual test metrics: 182 passing tests across 14 test suites
- Aligns with honest documentation standard across the LE family

## [1.0.0] - 2025-10-12

### Added

- Initial release of Numbers-LE
- Extract numbers from JSON, YAML, CSV, TOML, INI, and ENV files
- Post-processing commands:
  - Sort numbers (numeric ascending/descending, magnitude ascending/descending)
  - Deduplicate numbers
  - Analyze numbers (statistics: count, sum, average, median, mode, min, max, range, standard deviation, variance, outliers)
- Status bar integration with quick access
- CSV streaming support for large files
- Configurable settings for all features
- Safety guards for large files and outputs
- Performance monitoring and telemetry
- Comprehensive test coverage (182 tests, 36.58% coverage)
- Full documentation suite
- Preview demo and command palette screenshots

### Features

- **Zero Hassle Extraction**: One-click number extraction from any supported file format
- **Smart Detection**: Automatically identifies numeric values while filtering out IDs and technical values
- **Statistical Analysis**: Built-in stats including mean, median, mode, standard deviation, and outlier detection
- **Multiple Sort Modes**: Numeric and magnitude-based sorting options
- **CSV Streaming**: Handle massive CSV files without memory issues
- **Side-by-Side Results**: View source and extracted numbers simultaneously
- **Keyboard Shortcuts**: Quick access via Ctrl+Alt+N / Cmd+Alt+N
- **Notifications**: Configurable notification levels (all, important, silent)
- **Safety First**: Warnings for large files and outputs with user confirmation

### Technical

- Bun-based CI/CD pipeline for fast builds
- TypeScript with strict mode enabled
- Vitest for testing with 100% pass rate
- Biome for linting and formatting
- Comprehensive error handling
- Performance benchmarks for all file formats
- Localization ready with vscode-nls

### Documentation

- Complete README with usage examples
- Architecture documentation
- Command reference
- Configuration guide
- Performance benchmarks
- Testing guide
- Troubleshooting guide
- Screenshots and visual guides

[1.0.0]: https://github.com/nolindnaidoo/numbers-le/releases/tag/v1.0.0
