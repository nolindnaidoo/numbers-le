import * as vscode from 'vscode';
import type { Telemetry } from '../telemetry/telemetry';
import type { Notifier } from '../ui/notifier';
import type { StatusBar } from '../ui/statusBar';
import type { PerformanceMonitor } from '../utils/performance';
import { dedupeNumbers } from './dedupe';
import { extractNumbers } from './extract';
import { sortNumbers } from './sort';

export interface CommandDependencies {
	notifier: Notifier;
	statusBar: StatusBar;
	telemetry: Telemetry;
	performanceMonitor: PerformanceMonitor;
}

export function registerCommands(
	context: vscode.ExtensionContext,
	deps: CommandDependencies,
): void {
	const commands = [
		vscode.commands.registerCommand(
			'numbers-le.extractNumbers',
			async () => await extractNumbers(deps),
		),
		vscode.commands.registerCommand(
			'numbers-le.postProcess.dedupe',
			async () => await dedupeNumbers(deps),
		),
		vscode.commands.registerCommand(
			'numbers-le.postProcess.sort',
			async () => await sortNumbers(deps),
		),
	];

	for (const command of commands) {
		context.subscriptions.push(command);
	}
}
