import * as nls from 'vscode-nls';
import type { ParseError } from '../types';

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

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

export function createEnhancedError(
	error: Error | ParseError,
	category: ErrorCategory,
	context?: Record<string, unknown>,
): EnhancedError {
	const baseError =
		'filepath' in error
			? error
			: { message: error.message, filepath: 'unknown' };

	return {
		category,
		type: determineErrorType(category, error),
		message: baseError.message,
		filepath: baseError.filepath || 'unknown',
		context: context || {},
		recoverable: isErrorRecoverable(category, error),
		userMessage: formatUserMessage(category, baseError),
		suggestion: generateSuggestion(category, baseError) || '',
	};
}

function determineErrorType(
	category: ErrorCategory,
	error: Error | ParseError,
): string {
	if (category === 'parse' && 'type' in error) {
		return error.type;
	}

	switch (category) {
		case 'parse':
			return 'syntax-error';
		case 'file-system':
			return 'file-access-error';
		case 'configuration':
			return 'invalid-setting';
		case 'validation':
			return 'validation-failed';
		case 'safety':
			return 'safety-threshold-exceeded';
		case 'operational':
			return 'operation-failed';
		case 'analysis':
			return 'analysis-failed';
		default:
			return 'unknown-error';
	}
}

function isErrorRecoverable(
	category: ErrorCategory,
	error: Error | ParseError,
): boolean {
	switch (category) {
		case 'parse':
		case 'configuration':
		case 'validation':
		case 'analysis':
			return true;
		case 'file-system':
			return (
				error.message.includes('permission') ||
				error.message.includes('network')
			);
		case 'safety':
			return false;
		case 'operational':
			return !error.message.includes('fatal');
		default:
			return false;
	}
}

function formatUserMessage(
	category: ErrorCategory,
	baseError: { message: string; filepath?: string },
): string {
	switch (category) {
		case 'parse':
			return localize(
				'runtime.error.parse',
				'Failed to parse file: {0}',
				baseError.filepath || 'unknown file',
			);
		case 'file-system':
			return localize(
				'runtime.error.file-system',
				'File system error: {0}',
				baseError.message,
			);
		case 'configuration':
			return localize(
				'runtime.error.configuration',
				'Configuration error: {0}',
				baseError.message,
			);
		case 'validation':
			return localize(
				'runtime.error.validation',
				'Validation failed: {0}',
				baseError.message,
			);
		case 'safety':
			return localize(
				'runtime.error.safety',
				'Safety threshold exceeded: {0}',
				baseError.message,
			);
		case 'operational':
			return localize(
				'runtime.error.operational',
				'Operation failed: {0}',
				baseError.message,
			);
		case 'analysis':
			return localize(
				'runtime.error.analysis',
				'Analysis failed: {0}',
				baseError.message,
			);
		default:
			return localize(
				'runtime.error.unknown',
				'Unknown error: {0}',
				baseError.message,
			);
	}
}

function generateSuggestion(
	category: ErrorCategory,
	baseError: { message: string; filepath?: string },
): string {
	switch (category) {
		case 'parse':
			return localize(
				'runtime.suggestion.parse',
				"Check the file syntax and ensure it's a valid format (JSON, YAML, CSV, TOML, INI, or ENV)",
			);
		case 'file-system':
			if (baseError.message.includes('permission')) {
				return localize(
					'runtime.suggestion.permission',
					'Check file permissions and ensure the extension has read access',
				);
			}
			if (baseError.message.includes('network')) {
				return localize(
					'runtime.suggestion.network',
					'Check network connectivity and try again',
				);
			}
			return localize(
				'runtime.suggestion.file-system',
				'Check if the file exists and is accessible',
			);
		case 'configuration':
			return localize(
				'runtime.suggestion.configuration',
				'Check your extension settings and fix any invalid values',
			);
		case 'validation':
			return localize(
				'runtime.suggestion.validation',
				'Review the input data and ensure it contains valid numeric values',
			);
		case 'safety':
			return localize(
				'runtime.suggestion.safety',
				'Adjust safety thresholds in settings or reduce the scope of the operation',
			);
		case 'operational':
			return localize(
				'runtime.suggestion.operational',
				'Try reloading the window or restarting VS Code',
			);
		case 'analysis':
			return localize(
				'runtime.suggestion.analysis',
				'Ensure sufficient numeric data exists for statistical analysis',
			);
		default:
			return localize(
				'runtime.suggestion.unknown',
				'Check the logs for more details and consider reporting this issue',
			);
	}
}

export function getErrorRecoveryOptions(
	error: EnhancedError,
): ErrorRecoveryOptions {
	switch (error.category) {
		case 'file-system':
			return {
				retryable: true,
				maxRetries: 3,
				retryDelay: 1000,
			};
		case 'operational':
			return {
				retryable: true,
				maxRetries: 2,
				retryDelay: 2000,
			};
		case 'configuration':
			return {
				retryable: false,
				maxRetries: 0,
				retryDelay: 0,
				fallbackAction: async () => {
					// Fallback to default configuration
				},
			};
		default:
			return {
				retryable: false,
				maxRetries: 0,
				retryDelay: 0,
			};
	}
}

export function sanitizeErrorMessage(message: string): string {
	return message
		.replace(/\/Users\/[^/]+\//g, '~/')
		.replace(/\/home\/[^/]+\//g, '~/')
		.replace(/C:\\Users\\[^\\]+\\/g, 'C:\\Users\\***\\')
		.replace(/[a-f0-9]{32,}/g, '***')
		.replace(/sk-[a-zA-Z0-9]+/g, 'sk-***')
		.replace(/AKIA[0-9A-Z]{16}/g, 'AKIA***');
}

export function formatErrorForLogging(error: EnhancedError): string {
	const parts = [
		`[${error.category.toUpperCase()}]`,
		error.type,
		error.message,
	];

	if (error.filepath) {
		parts.push(`File: ${error.filepath}`);
	}

	if (error.line) {
		parts.push(`Line: ${error.line}`);
	}

	if (error.column) {
		parts.push(`Column: ${error.column}`);
	}

	if (error.context) {
		parts.push(`Context: ${JSON.stringify(error.context)}`);
	}

	return parts.join(' | ');
}

export function shouldReportError(
	error: EnhancedError,
	notificationLevel: 'all' | 'important' | 'silent',
): boolean {
	if (notificationLevel === 'silent') {
		return false;
	}

	if (notificationLevel === 'important') {
		return (
			error.category === 'safety' ||
			error.category === 'operational' ||
			!error.recoverable
		);
	}

	return true;
}

export function getErrorSeverity(
	error: EnhancedError,
): 'info' | 'warning' | 'error' {
	switch (error.category) {
		case 'parse':
		case 'configuration':
		case 'validation':
		case 'analysis':
			return 'warning';
		case 'file-system':
		case 'operational':
		case 'safety':
			return 'error';
		default:
			return 'error';
	}
}

export function createErrorSummary(errors: readonly EnhancedError[]): {
	total: number;
	byCategory: Record<ErrorCategory, number>;
	bySeverity: Record<string, number>;
	recoverable: number;
	nonRecoverable: number;
} {
	const byCategory: Record<ErrorCategory, number> = {
		parse: 0,
		validation: 0,
		safety: 0,
		operational: 0,
		'file-system': 0,
		configuration: 0,
		analysis: 0,
	};

	const bySeverity: Record<string, number> = {
		info: 0,
		warning: 0,
		error: 0,
	};

	let recoverable = 0;
	let nonRecoverable = 0;

	for (const error of errors) {
		byCategory[error.category]++;
		const severity = getErrorSeverity(error);
		bySeverity[severity] = (bySeverity[severity] || 0) + 1;

		if (error.recoverable) {
			recoverable++;
		} else {
			nonRecoverable++;
		}
	}

	return {
		total: errors.length,
		byCategory,
		bySeverity,
		recoverable,
		nonRecoverable,
	};
}
