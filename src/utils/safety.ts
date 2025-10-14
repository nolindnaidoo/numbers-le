import * as nls from 'vscode-nls';
import type { NumbersLeConfig } from '../config/config';

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

/**
 * Safety utilities for Numbers-LE
 * Provides safety checks and warnings for large files, large outputs, and performance concerns
 */

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

/**
 * Perform comprehensive safety checks before extraction
 */
export function performSafetyChecks(
	fileSize: number,
	config: NumbersLeConfig,
): SafetyCheckResult {
	const metrics = calculateSafetyMetrics(fileSize);
	const warnings: string[] = [];
	const errors: string[] = [];
	const recommendations: string[] = [];

	// Check file size
	if (fileSize > config.fileSizeWarnBytes * 10) {
		// 10x threshold
		errors.push(
			localize(
				'runtime.safety.error.large-file',
				'File size too large ({0} MB). This may cause performance issues.',
				Math.round(fileSize / (1024 * 1024)),
			),
		);
		recommendations.push(
			localize(
				'runtime.safety.recommendation.large-file',
				'Consider using CSV streaming mode or splitting the file into smaller chunks',
			),
		);
	} else if (fileSize > config.fileSizeWarnBytes) {
		warnings.push(
			localize(
				'runtime.safety.warning.large-file',
				'Large file detected ({0} MB). Processing may take longer.',
				Math.round(fileSize / (1024 * 1024)),
			),
		);
		recommendations.push(
			localize(
				'runtime.safety.recommendation.enable-streaming',
				'Enable CSV streaming in settings for better performance with large files',
			),
		);
	}

	// Check estimated processing time
	if (metrics.estimatedProcessingTime > 10000) {
		// 10 seconds
		errors.push(
			localize(
				'runtime.safety.error.long-processing',
				'Estimated processing time too long ({0} seconds). This may cause UI freezing.',
				Math.round(metrics.estimatedProcessingTime / 1000),
			),
		);
		recommendations.push(
			localize(
				'runtime.safety.recommendation.long-processing',
				'Consider disabling automatic analysis or using CSV streaming',
			),
		);
	} else if (metrics.estimatedProcessingTime > 5000) {
		// 5 seconds
		warnings.push(
			localize(
				'runtime.safety.warning.long-processing',
				'Long processing time expected ({0} seconds). Consider adjusting settings.',
				Math.round(metrics.estimatedProcessingTime / 1000),
			),
		);
	}

	// Check memory usage
	if (metrics.memoryUsage > 100 * 1024 * 1024) {
		// 100MB
		warnings.push(
			localize(
				'runtime.safety.warning.high-memory',
				'High memory usage expected ({0} MB). Monitor system resources.',
				Math.round(metrics.memoryUsage / (1024 * 1024)),
			),
		);
		recommendations.push(
			localize(
				'runtime.safety.recommendation.high-memory',
				'Use CSV streaming mode or disable automatic sorting/deduplication to reduce memory usage',
			),
		);
	}

	const safe = errors.length === 0;

	return {
		safe,
		warnings: Object.freeze(warnings),
		errors: Object.freeze(errors),
		metrics,
		recommendations: Object.freeze(recommendations),
	};
}

/**
 * Check safety for large output
 */
export function checkOutputSafety(
	numberCount: number,
	config: NumbersLeConfig,
): SafetyCheckResult {
	const warnings: string[] = [];
	const errors: string[] = [];
	const recommendations: string[] = [];

	const outputLines = numberCount; // One number per line
	const metrics: SafetyMetrics = {
		fileSize: 0,
		numberCount,
		estimatedProcessingTime: 0,
		memoryUsage: numberCount * 16, // Rough estimate: 16 bytes per number
		outputLines,
	};

	if (outputLines > config.largeOutputLinesThreshold * 2) {
		errors.push(
			localize(
				'runtime.safety.error.large-output',
				'Output too large ({0} numbers). This may overwhelm the editor.',
				outputLines,
			),
		);
		recommendations.push(
			localize(
				'runtime.safety.recommendation.large-output',
				'Consider copying to clipboard instead of opening in editor, or enable deduplication',
			),
		);
	} else if (outputLines > config.largeOutputLinesThreshold) {
		warnings.push(
			localize(
				'runtime.safety.warning.large-output',
				'Large output detected ({0} numbers). Opening may be slow.',
				outputLines,
			),
		);
		recommendations.push(
			localize(
				'runtime.safety.recommendation.copy-clipboard',
				"Consider using 'Copy to Clipboard' option for large outputs",
			),
		);
	}

	const safe = errors.length === 0;

	return {
		safe,
		warnings: Object.freeze(warnings),
		errors: Object.freeze(errors),
		metrics,
		recommendations: Object.freeze(recommendations),
	};
}

/**
 * Calculate safety metrics
 */
function calculateSafetyMetrics(fileSize: number): SafetyMetrics {
	// Rough estimates based on typical extraction performance
	// These values are conservative to ensure safety
	const estimatedNumbersPerKB = 10; // Very conservative estimate
	const estimatedNumberCount = (fileSize / 1024) * estimatedNumbersPerKB;

	// Estimate processing time based on file size
	// Assuming ~1MB/sec processing speed (conservative)
	const estimatedProcessingTime = (fileSize / (1024 * 1024)) * 1000;

	// Estimate memory usage (file size + overhead for parsing)
	const memoryUsage = fileSize * 2;

	return {
		fileSize,
		numberCount: estimatedNumberCount,
		estimatedProcessingTime,
		memoryUsage,
		outputLines: estimatedNumberCount,
	};
}

/**
 * Check if operation should proceed based on safety checks
 */
export function shouldProceedWithOperation(
	safetyResult: SafetyCheckResult,
	config: NumbersLeConfig,
): boolean {
	// If safety is disabled, always proceed
	if (!config.safetyEnabled) {
		return true;
	}

	// If there are errors, don't proceed
	if (safetyResult.errors.length > 0) {
		return false;
	}

	// If there are warnings, proceed but show warnings
	return true;
}

/**
 * Get safety configuration recommendations
 */
export function getSafetyRecommendations(
	safetyResult: SafetyCheckResult,
	config: NumbersLeConfig,
): readonly string[] {
	const recommendations: string[] = [];

	// Add safety result recommendations
	recommendations.push(...safetyResult.recommendations);

	// Add configuration-specific recommendations
	if (
		safetyResult.metrics.fileSize > config.fileSizeWarnBytes &&
		!config.csvStreamingEnabled
	) {
		recommendations.push(
			localize(
				'runtime.safety.recommendation.enable-csv-streaming',
				'Enable CSV streaming mode in settings for better performance with large files',
			),
		);
	}

	if (
		safetyResult.metrics.numberCount > 10000 &&
		config.analysisEnabled &&
		config.analysisIncludeStats
	) {
		recommendations.push(
			localize(
				'runtime.safety.recommendation.disable-analysis',
				'Consider disabling automatic analysis for faster extraction with large datasets',
			),
		);
	}

	if (
		safetyResult.metrics.outputLines > config.largeOutputLinesThreshold &&
		!config.copyToClipboardEnabled
	) {
		recommendations.push(
			localize(
				'runtime.safety.recommendation.use-clipboard',
				"Enable 'Copy to Clipboard' in settings to avoid opening large outputs in editor",
			),
		);
	}

	return Object.freeze(recommendations);
}

/**
 * Format safety report for display
 */
export function formatSafetyReport(safetyResult: SafetyCheckResult): string {
	const lines: string[] = [];

	lines.push('# Numbers-LE Safety Report');
	lines.push('');

	// Status
	lines.push(
		`**Status**: ${safetyResult.safe ? '✅ Safe' : '⚠️ Warnings/Errors'}`,
	);
	lines.push('');

	// Metrics
	lines.push('## Metrics');
	lines.push(
		`- **File Size**: ${formatFileSize(safetyResult.metrics.fileSize)}`,
	);
	lines.push(
		`- **Estimated Numbers**: ${Math.round(safetyResult.metrics.numberCount)}`,
	);
	lines.push(
		`- **Estimated Processing Time**: ${Math.round(
			safetyResult.metrics.estimatedProcessingTime / 1000,
		)}s`,
	);
	lines.push(
		`- **Estimated Memory Usage**: ${formatFileSize(
			safetyResult.metrics.memoryUsage,
		)}`,
	);
	lines.push(
		`- **Output Lines**: ${Math.round(safetyResult.metrics.outputLines)}`,
	);
	lines.push('');

	// Warnings
	if (safetyResult.warnings.length > 0) {
		lines.push('## ⚠️ Warnings');
		for (const warning of safetyResult.warnings) {
			lines.push(`- ${warning}`);
		}
		lines.push('');
	}

	// Errors
	if (safetyResult.errors.length > 0) {
		lines.push('## ❌ Errors');
		for (const error of safetyResult.errors) {
			lines.push(`- ${error}`);
		}
		lines.push('');
	}

	// Recommendations
	if (safetyResult.recommendations.length > 0) {
		lines.push('## 💡 Recommendations');
		for (const recommendation of safetyResult.recommendations) {
			lines.push(`- ${recommendation}`);
		}
		lines.push('');
	}

	return lines.join('\n');
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes} B`;
	} else if (bytes < 1024 * 1024) {
		return `${Math.round(bytes / 1024)} KB`;
	} else {
		return `${Math.round(bytes / (1024 * 1024))} MB`;
	}
}

/**
 * Check if file should be excluded based on safety criteria
 */
export function shouldExcludeFileForSafety(
	fileSize: number,
	config: NumbersLeConfig,
): boolean {
	// Check file size threshold
	if (config.safetyEnabled && fileSize > config.fileSizeWarnBytes * 10) {
		return true;
	}

	return false;
}

/**
 * Get safety configuration defaults
 */
export function getSafetyDefaults(): {
	readonly fileSizeWarnBytes: number;
	readonly largeOutputLinesThreshold: number;
	readonly manyDocumentsThreshold: number;
} {
	return Object.freeze({
		fileSizeWarnBytes: 1024 * 1024, // 1MB
		largeOutputLinesThreshold: 50000, // 50K lines
		manyDocumentsThreshold: 8, // 8 documents
	});
}
