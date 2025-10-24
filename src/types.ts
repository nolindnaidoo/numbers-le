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

export interface AnalysisResult {
	count: number;
	sum: number;
	average: number;
	min: number;
	max: number;
	median: number;
	mode?: number | undefined;
	range: number;
}

export type FileType =
	| 'json'
	| 'yaml'
	| 'yml'
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
	readonly analysisEnabled: boolean;
	readonly analysisIncludeStats: boolean;
}

// Error handling types
export type ErrorCategory =
	| 'parse'
	| 'validation'
	| 'safety'
	| 'operational'
	| 'file-system'
	| 'analysis'
	| 'configuration';

export interface EnhancedError {
	readonly category: ErrorCategory;
	readonly type: string;
	readonly message: string;
	readonly filepath: string;
	readonly line?: number;
	readonly column?: number;
	readonly context: Record<string, unknown>;
	readonly recoverable: boolean;
	readonly userMessage: string;
	readonly suggestion: string;
}

export interface ErrorRecoveryOptions {
	readonly retryable: boolean;
	readonly maxRetries: number;
	readonly retryDelay: number;
	readonly fallbackAction?: () => Promise<void>;
}

// Performance monitoring types
export interface PerformanceMetrics {
	readonly operation: string;
	readonly startTime: number;
	readonly endTime: number;
	readonly duration: number;
	readonly numberCount: number;
	readonly fileSize: number;
	readonly memoryUsage: number;
	readonly cpuUsage: number;
	readonly throughput: number;
	readonly cacheHits: number;
	readonly cacheMisses: number;
}

export interface PerformanceReport {
	readonly metrics: PerformanceMetrics;
	readonly recommendations: readonly string[];
	readonly warnings: readonly string[];
	readonly optimizations: readonly string[];
}

export interface PerformanceThresholds {
	readonly maxDuration: number;
	readonly maxMemoryUsage: number;
	readonly maxCpuUsage: number;
	readonly minThroughput: number;
}

// Safety check types
export interface SafetyMetrics {
	readonly fileSize: number;
	readonly numberCount: number;
	readonly estimatedProcessingTime: number;
	readonly memoryUsage: number;
	readonly outputLines: number;
}

export interface SafetyCheckResult {
	readonly safe: boolean;
	readonly warnings: readonly string[];
	readonly errors: readonly string[];
	readonly metrics: SafetyMetrics;
	readonly recommendations: readonly string[];
}
