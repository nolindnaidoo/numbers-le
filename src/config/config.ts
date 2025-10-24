import * as vscode from 'vscode';
import * as nls from 'vscode-nls';
import type { SortMode } from '../utils/sort';

const localize = nls.config({ messageFormat: nls.MessageFormat.file })();

export function readConfig(): NumbersLeConfig {
	const cfg = vscode.workspace.getConfiguration('numbers-le');

	const dedupeEnabled = Boolean(cfg.get('dedupeEnabled', false));
	const sortEnabled = Boolean(cfg.get('sortEnabled', false));
	const sortModeRaw = cfg.get('sortMode', 'off');
	const sortMode = isValidSortMode(sortModeRaw) ? sortModeRaw : 'off';
	const showParseErrors = Boolean(cfg.get('showParseErrors', false));
	const openInNewFile = Boolean(cfg.get('postProcess.openInNewFile', false));
	const openResultsSideBySide = Boolean(
		cfg.get('openResultsSideBySide', false),
	);
	const telemetryEnabled = Boolean(cfg.get('telemetryEnabled', false));
	const copyToClipboardEnabled = Boolean(
		cfg.get('copyToClipboardEnabled', false),
	);
	const notifRaw = cfg.get('notificationsLevel', 'silent');
	const notificationsLevel = isValidNotificationLevel(notifRaw)
		? notifRaw
		: 'silent';
	const statusBarEnabled = Boolean(cfg.get('statusBar.enabled', true));
	const safetyEnabled = Boolean(cfg.get('safety.enabled', true));
	const fileSizeWarnBytes = Math.max(
		1000,
		Number(cfg.get('safety.fileSizeWarnBytes', 1_000_000)),
	);
	const largeOutputLinesThreshold = Math.max(
		100,
		Number(cfg.get('safety.largeOutputLinesThreshold', 50_000)),
	);
	const manyDocumentsThreshold = Math.max(
		1,
		Number(cfg.get('safety.manyDocumentsThreshold', 8)),
	);
	const csvStreamingEnabled = Boolean(cfg.get('csv.streamingEnabled', false));
	const analysisEnabled = Boolean(cfg.get('analysis.enabled', true));
	const analysisIncludeStats = Boolean(cfg.get('analysis.includeStats', true));
	const performanceEnabled = Boolean(cfg.get('performance.enabled', true));
	const performanceMaxDuration = Math.max(
		1000,
		Number(cfg.get('performance.maxDuration', 5000)),
	);
	const performanceMaxMemoryUsage = Math.max(
		1048576,
		Number(cfg.get('performance.maxMemoryUsage', 104857600)),
	);
	const performanceMaxCpuUsage = Math.max(
		100000,
		Number(cfg.get('performance.maxCpuUsage', 1000000)),
	);
	const performanceMinThroughput = Math.max(
		100,
		Number(cfg.get('performance.minThroughput', 1000)),
	);
	const performanceMaxCacheSize = Math.max(
		100,
		Number(cfg.get('performance.maxCacheSize', 1000)),
	);

	// Freeze to communicate immutability to consumers
	return Object.freeze({
		dedupeEnabled,
		sortEnabled,
		sortMode,
		showParseErrors,
		openInNewFile,
		openResultsSideBySide,
		telemetryEnabled,
		copyToClipboardEnabled,
		notificationsLevel,
		statusBarEnabled,
		safetyEnabled,
		fileSizeWarnBytes,
		largeOutputLinesThreshold,
		manyDocumentsThreshold,
		csvStreamingEnabled,
		analysisEnabled,
		analysisIncludeStats,
		performanceEnabled,
		performanceMaxDuration,
		performanceMaxMemoryUsage,
		performanceMaxCpuUsage,
		performanceMinThroughput,
		performanceMaxCacheSize,
	});
}

export type NotificationLevel = 'all' | 'important' | 'silent';

export function isValidSortMode(v: unknown): v is SortMode {
	return (
		v === 'off' ||
		v === 'numeric-asc' ||
		v === 'numeric-desc' ||
		v === 'magnitude-asc' ||
		v === 'magnitude-desc'
	);
}

export function isValidNotificationLevel(v: unknown): v is NotificationLevel {
	return v === 'all' || v === 'important' || v === 'silent';
}

export type NumbersLeConfig = Readonly<{
	dedupeEnabled: boolean;
	sortEnabled: boolean;
	sortMode: SortMode;
	showParseErrors: boolean;
	openInNewFile: boolean;
	openResultsSideBySide: boolean;
	telemetryEnabled: boolean;
	copyToClipboardEnabled: boolean;
	notificationsLevel: NotificationLevel;
	statusBarEnabled: boolean;
	safetyEnabled: boolean;
	fileSizeWarnBytes: number;
	largeOutputLinesThreshold: number;
	manyDocumentsThreshold: number;
	csvStreamingEnabled: boolean;
	analysisEnabled: boolean;
	analysisIncludeStats: boolean;
	performanceEnabled: boolean;
	performanceMaxDuration: number;
	performanceMaxMemoryUsage: number;
	performanceMaxCpuUsage: number;
	performanceMinThroughput: number;
	performanceMaxCacheSize: number;
}>;

void localize;
