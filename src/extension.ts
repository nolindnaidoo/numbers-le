import type * as vscode from 'vscode';
import { registerCommands } from './commands';
import { registerHelpCommand } from './commands/help';
import { readConfig } from './config/config';
import { registerOpenSettingsCommand } from './config/settings';
import { createTelemetry } from './telemetry/telemetry';
import { createNotifier } from './ui/notifier';
import { createStatusBar } from './ui/statusBar';
import { createPerformanceMonitor } from './utils/performance';

export function activate(context: vscode.ExtensionContext): void {
	const telemetry = createTelemetry();
	const notifier = createNotifier();
	const statusBar = createStatusBar(context);

	// Register disposables
	context.subscriptions.push(telemetry);

	// Initialize performance monitoring
	const config = readConfig();
	const performanceMonitor = createPerformanceMonitor(config);

	// Register all commands with utilities
	registerCommands(context, {
		telemetry,
		notifier,
		statusBar,
		performanceMonitor,
	});

	// Register settings and help commands
	registerOpenSettingsCommand(context, telemetry);
	registerHelpCommand(context, telemetry);

	telemetry.event('extension-activated');
}

export function deactivate(): void {
	// Extensions are automatically disposed via context.subscriptions
}
