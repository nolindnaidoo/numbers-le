# Numbers-LE Architecture

Technical architecture, design patterns, and module boundaries for production-grade number extraction at scale.

## Core Structure

```
src/
├── extension.ts          # Minimal activation - registers commands/providers only
├── types.ts             # Core type definitions and interfaces
├── commands/            # Command implementations with dependency injection
│   ├── index.ts         # Centralized command registration
│   ├── extract.ts       # Main extraction command
│   ├── dedupe.ts        # Deduplication post-processing
│   ├── sort.ts          # Sorting post-processing
│   └── analyze.ts       # Statistical analysis command
├── extraction/          # Number extraction engine
│   ├── extract.ts       # Router pattern - delegates to format handlers
│   ├── collect.ts       # Recursive object traversal utilities
│   ├── formats/         # Format-specific extractors
│   │   ├── json.ts      # JSON parser with error handling
│   │   ├── yaml.ts      # YAML parser
│   │   ├── csv.ts       # CSV parser with streaming support
│   │   ├── toml.ts      # TOML parser
│   │   ├── ini.ts       # INI file parser
│   │   └── env.ts       # Environment file parser
│   └── __data__/        # Test fixtures with expected outputs
├── config/              # Configuration management
│   ├── config.ts        # Main config reader with frozen objects
│   └── settings.ts      # VS Code settings command registration
├── ui/                  # User interface components
│   ├── statusBar.ts     # Status bar factory with flash messaging
│   ├── notifier.ts      # Notification abstraction
│   └── prompts.ts       # User input prompts
├── utils/               # Pure utility functions
│   ├── analysis.ts      # Statistical analysis (mean, median, std dev)
│   ├── sort.ts          # Number sorting utilities
│   └── validation.ts    # Input validation
└── telemetry/           # Local-only logging
    └── telemetry.ts     # Output channel factory
```

## Runtime Flow

```mermaid
flowchart LR
  A["VS Code Editor\nActive Document"] --> B["Command\nnumbers-le.extractNumbers"]
  B --> C["Extraction Router\nextraction/extract.ts"]
  C --> D["Format Extractors\n(json/yaml/csv/toml/ini/env)"]
  D --> E["Collect Numbers\nextraction/collect.ts"]
  E --> F["Post-Process\n(dedupe/sort)"]
  F --> G["Output Handler\nOpen editor / Analysis"]

  I["Configuration\nconfig/config.ts (frozen)"] -.-> B
  I -.-> C
  I -.-> F
  I -.-> G

  J["Safety Guards\nfile size / output size / memory"] -.-> B
  J -.-> G

  H["UI\nStatus Bar / Notifier / Prompts"] <--> B
  H -.-> G

  K["Telemetry\nlocal-only Output channel"] -.-> B
  K -.-> C
  K -.-> D
  K -.-> F

  classDef dim fill:#eee,stroke:#bbb,color:#333
  class I,J,K,H dim
```

Key properties:

- Configuration is read once per action and exposed as immutable objects
- Errors never throw from extractors; safe defaults are returned
- Safety prompts offer Open / Copy / Cancel for large outputs
- Statistical analysis is opt-in via configuration

## Module Boundaries and Dependencies

```mermaid
graph TD
  subgraph VSCode["VS Code API"]
    vscode[vscode]
  end

  subgraph Ext["Extension Shell"]
    ext[src/extension.ts]
  end

  subgraph Cmds["Commands"]
    cmdIndex[src/commands/index.ts]
    cmdExtract[src/commands/extract.ts]
    cmdDedupe[src/commands/dedupe.ts]
    cmdSort[src/commands/sort.ts]
    cmdAnalyze[src/commands/analyze.ts]
  end

  subgraph Extract["Extraction Engine"]
    exRouter[src/extraction/extract.ts]
    exCollect[src/extraction/collect.ts]
    exFormats[src/extraction/formats/*]
  end

  subgraph UI["UI Components"]
    uiStatus[src/ui/statusBar.ts]
    uiNotify[src/ui/notifier.ts]
    uiPrompts[src/ui/prompts.ts]
  end

  subgraph Config["Configuration"]
    cfg[src/config/config.ts]
  end

  subgraph Utils["Utilities & Types"]
    utilAnalysis[src/utils/analysis.ts]
    utilSort[src/utils/sort.ts]
    utilValidation[src/utils/validation.ts]
    types[src/types.ts]
  end

  subgraph Telemetry["Telemetry (local-only)"]
    tel[src/telemetry/telemetry.ts]
  end

  ext --> cmdIndex
  cmdIndex --> cmdExtract
  cmdIndex --> cmdDedupe
  cmdIndex --> cmdSort
  cmdIndex --> cmdAnalyze

  cmdExtract --> exRouter
  cmdExtract --> uiNotify
  cmdExtract --> uiStatus
  cmdExtract --> uiPrompts
  cmdExtract --> cfg
  cmdExtract --> tel

  exRouter --> exFormats
  exRouter --> exCollect

  cmdAnalyze --> utilAnalysis
  cmdDedupe --> utilValidation
  cmdSort --> utilSort

  cfg --> types

  ext --> vscode
  cmdIndex --> vscode
  UI --> vscode
```

Conventions:

- All factory outputs are immutable; data structures use `readonly` and `Object.freeze()`
- Dependency injection is used for commands; `src/extension.ts` stays thin
- Modules prefer pure functions with explicit return types

---

## Architectural Principles

- **Minimal activation**: `src/extension.ts` wires dependencies and registers disposables only
- **Pure core**: extraction, utilities, and analysis are pure functions with explicit return types
- **Immutable data**: config and results are frozen; no in-place mutations
- **Safety first**: guard rails for file size, output size, and memory usage
- **Progressive disclosure**: subtle status bar feedback; prompts only when needed
- **Performance by design**: streaming support for large datasets, efficient algorithms

## Design Rationale

### Why Functional Over OOP

**Decision**: Use factory functions and pure functions rather than classes.

**Rationale**:

- Immutability guarantees via `Object.freeze()` prevent entire classes of bugs
- Pure functions are trivially testable without complex mock hierarchies
- No hidden state or side effects; all dependencies are explicit
- Smaller bundle size (no class overhead)
- Better tree-shaking in bundlers

**Trade-off**: Slightly more verbose dependency passing, but gains in testability and reliability far outweigh this cost.

### Router Pattern for Format Extraction

**Decision**: Single entry point (`extract.ts`) delegates to format-specific modules.

**Rationale**:

- Format-specific logic is isolated and independently testable
- Adding new formats requires no changes to existing extractors
- Error handling is centralized with consistent behavior
- Easy to disable or modify specific format support

**Trade-off**: Extra indirection layer, but the modularity and maintainability justify it.

### Streaming for CSV

**Decision**: Implement generator-based streaming for CSV files.

**Rationale**:

- CSV files in enterprise environments can exceed 500MB
- Streaming keeps memory usage constant regardless of file size
- Progressive feedback via status bar improves UX for large files
- Allows cancellation mid-stream without wasted work

**Trade-off**: Streaming implementation is more complex, but essential for production use cases.

### Performance Monitoring Classes

**Decision**: Use classes for `PerformanceMonitor` and `PerformanceTracker` instead of factory functions.

**Rationale**:

- Stateful performance tracking requires encapsulated mutable state (timers, metrics)
- Class lifecycle methods (`startTimer`/`endTimer`) provide clearer semantics than closures
- Internal state mutations are intentionally hidden from consumers
- Created via factory function `createPerformanceMonitor()` to maintain consistency with codebase patterns

**Scope**: Limited to performance utilities only. All other services use factory functions.

**Trade-off**: Deviation from pure functional pattern, but classes provide better encapsulation for this specific use case.

## Component Responsibilities

- **`commands/*`**: Orchestrate user interactions, read config, call core functions, present results
- **`extraction/*`**: Parse input and return `readonly number[]` with safe defaults
- **`ui/*`**: Present status, notifications, prompts for user feedback
- **`config/config.ts`**: Read, validate, freeze, and expose settings
- **`utils/*`**: Side-effect free helpers (analysis, sorting, validation)
- **`telemetry/telemetry.ts`**: Local-only Output channel logging

### Public Interfaces

```ts
export type ExtractorOptions = Readonly<{
  onParseError?: (message: string) => void;
  includeFloats?: boolean;
  includeIntegers?: boolean;
}>;

export type Extractor = (
  text: string,
  options?: ExtractorOptions
) => readonly number[];

export type NumbersLeConfig = Readonly<{
  dedupeEnabled: boolean;
  sortEnabled: boolean;
  sortMode: "asc" | "desc";
  analysis: Readonly<{
    enabled: boolean;
    includeStats: boolean;
  }>;
  safety: Readonly<{
    enabled: boolean;
    fileSizeWarnBytes: number;
    largeOutputLinesThreshold: number;
  }>;
  csv: Readonly<{ streamingEnabled: boolean }>;
  telemetryEnabled: boolean;
}>;

export type AnalysisResult = Readonly<{
  count: number;
  sum: number;
  average: number;
  min: number;
  max: number;
  median: number;
  mode: readonly number[];
  range: number;
  variance: number;
  standardDeviation: number;
}>;
```

## Sequence: Extract Command

```mermaid
sequenceDiagram
  participant U as User
  participant V as VS Code
  participant EXT as extension.ts
  participant CMD as commands/extract.ts
  participant CFG as config/config.ts
  participant ROUTE as extraction/extract.ts
  participant FMT as extraction/formats/*
  participant UI as ui/*

  U->>V: Run "Numbers-LE: Extract"
  V->>EXT: activation/dispatch
  EXT->>CMD: invoke with injected deps
  CMD->>CFG: readConfig() → frozen config
  CMD->>UI: statusBar.flash("Extracting…")
  CMD->>ROUTE: extract(text, options)
  ROUTE->>FMT: delegate to format extractor
  FMT-->>ROUTE: readonly number[] (safe defaults on error)
  ROUTE-->>CMD: readonly number[]
  CMD->>UI: large output checks → prompt Open/Copy/Cancel
  CMD->>V: open editor and/or analyze
  CMD->>UI: notify success/warnings
```

## Dependency Injection Contracts

```ts
export function registerAllCommands(
  context: vscode.ExtensionContext,
  deps: Readonly<{
    telemetry: Telemetry;
    notifier: Notifier;
    statusBar: StatusBar;
  }>
): void;
```

Guidelines:

- Construct UI and telemetry factories at activation; pass to command registrars
- Keep all state within function scope or minimal module closures; avoid globals

## Cross-Cutting Concerns

- **Localization**: Manifest strings in `package.nls*.json`; runtime via `vscode-nls`
- **Telemetry**: Local-only; off by default; outputs to Output panel
- **Safety**: Thresholds and prompts central to UX; never block without an option to proceed
- **Cancellation**: Use `withProgress` and cancellation tokens for long operations

## Extensibility Playbooks

- **Add extractor**: Implement `Extractor`, register in router, add tests and fixtures
- **Add command**: Create factory in `commands/`, declare in `package.json`, wire registration
- **Add setting**: Update `package.json` contributes, read/validate in config, consume in logic
- **Add analysis metric**: Extend `AnalysisResult`, implement in `utils/analysis.ts`, add tests

## Performance Budgets

- Small files (<100KB) end-to-end under ~100ms common path
- Large files (1-10MB) under 2 seconds with streaming
- Memory usage capped at 500MB with safety warnings
- Statistical analysis adds <30% processing time

## Security & Privacy

- No network calls; all processing is local
- Respect workspace trust and virtual workspace limitations
- Validate user inputs and file operations
- Sanitize prompts to prevent injection attacks

## Safety & UX Decision Flow

```mermaid
flowchart TD
  A["Extracted numbers (N)"] --> B{Safety enabled?}
  B -- "No" --> E["Open editor and/or analyze"]
  B -- "Yes" --> C{N > largeOutputLinesThreshold?}
  C -- "No" --> E
  C -- "Yes" --> D["Prompt: Open / Copy / Cancel"]
  D -- "Open" --> E
  D -- "Copy" --> F["Write to clipboard"]
  D -- "Cancel" --> G["Abort"]
```

## CSV Streaming Pipeline

```mermaid
sequenceDiagram
  participant U as User
  participant CMD as commands/extract.ts
  participant STR as streamCsvNumbers()
  participant EDT as VS Code Editor

  U->>CMD: Run extract (CSV, streaming enabled)
  CMD->>STR: start generator (opts)
  loop rows
    STR-->>CMD: yield number[]
    CMD->>CMD: queue in batch (<= 1000 or 100ms)
    alt batch full or timer
      CMD->>EDT: append lines
    end
  end
  CMD->>EDT: final flush
  CMD->>U: statusBar.flash CSV streamed
```

---

**Project:** [Issues](https://github.com/OffensiveEdge/numbers-le/issues) • [Pull Requests](https://github.com/OffensiveEdge/numbers-le/pulls) • [Releases](https://github.com/OffensiveEdge/numbers-le/releases)

**Docs:** [Architecture](ARCHITECTURE.md) • [Testing](TESTING.md) • [Performance](PERFORMANCE.md) • [Development](DEVELOPMENT.md) • [Troubleshooting](TROUBLESHOOTING.md) • [Privacy](PRIVACY.md)
