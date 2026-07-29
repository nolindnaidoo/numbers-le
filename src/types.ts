export interface ExtractionResult {
	success: boolean;
	numbers: readonly number[];
	errors: readonly ParseError[];
}

export interface ParseError {
	type: 'parse-error' | 'validation-error';
	message: string;
	filepath?: string;
}

export type FileType =
	| 'json'
	| 'yaml'
	| 'csv'
	| 'toml'
	| 'ini'
	| 'env'
	| 'unknown';

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
