/**
 * How a literal was written, where this extension read the literal
 * itself.
 *
 * It follows coercion. A typed format hands over a number its own parser
 * already resolved — `0x1A` is 26 by the time TOML reaches the walker,
 * and the token is gone — so those report `decimal`. An untyped format
 * hands over text that `parseStrictNumber` reads here, so those keep
 * what the text said. Source languages and the plain-text scan read
 * their literals directly and keep everything.
 */
export type Notation =
	| 'decimal'
	| 'hex'
	| 'binary'
	| 'octal'
	| 'scientific'
	| 'bigint';

/** One extracted number, and how the source wrote it. */
export interface NumberFinding {
	readonly value: number;
	readonly notation: Notation;
}

export interface ExtractionResult {
	readonly success: boolean;
	readonly numbers: readonly NumberFinding[];
	readonly errors: readonly ParseError[];
}

export interface ParseError {
	readonly type: 'parse-error' | 'validation-error';
	readonly message: string;
	readonly filepath?: string;
}

export type FileType =
	| 'json'
	| 'yaml'
	| 'csv'
	| 'toml'
	| 'ini'
	| 'env'
	| SourceLanguage
	| 'unknown';

/**
 * The languages read by the numeric-literal extractor rather than by a
 * format parser or the text scan.
 *
 * They resolve to their own names rather than to one `source` key
 * because a dialect changes an answer — `0755` is 493 in Go and 755 in
 * Rust — and because the name is user-visible as `fileType` in every MCP
 * reply.
 */
export type SourceLanguage =
	| 'python'
	| 'rust'
	| 'go'
	| 'java'
	| 'kotlin'
	| 'csharp'
	| 'cpp'
	| 'c'
	| 'javascript'
	| 'typescript'
	| 'sql'
	| 'shellscript';

export type SortMode =
	| 'off'
	| 'numeric-asc'
	| 'numeric-desc'
	| 'magnitude-asc'
	| 'magnitude-desc';

export interface Configuration {
	readonly copyToClipboardEnabled: boolean;
	readonly csvStreamingEnabled: boolean;
	readonly dedupeEnabled: boolean;
	readonly notificationsLevel: 'all' | 'important' | 'silent';
	readonly postProcessOpenInNewFile: boolean;
	readonly openResultsSideBySide: boolean;
	readonly safetyEnabled: boolean;
	readonly safetyFileSizeWarnBytes: number;
	readonly safetyLargeOutputLinesThreshold: number;
	readonly safetyManyDocumentsThreshold: number;
	readonly showParseErrors: boolean;
	readonly sortEnabled: boolean;
	readonly sortMode: SortMode;
	readonly statusBarEnabled: boolean;
	readonly telemetryEnabled: boolean;
}
