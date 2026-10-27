import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	_configListenerCount,
	_createDocument,
	_createExtensionContext,
	_outputChannels,
	_registeredCommands,
	_resetMockState,
	_respondToQuickPick,
	_setActiveEditor,
	_setConfig,
	_statusBarItems,
} from './__mocks__/vscode';
import { activate } from './extension';

/**
 * Deactivation leaves nothing alive, and repeated runs do not grow.
 *
 * The host keeps an extension up for days, so a timer that survives
 * deactivation or a listener added per command is a real leak. The mock
 * counts what it created and has not released; this activates against it,
 * runs every command, disposes every subscription and reads the counts back
 * as zeros, then runs every command fifty times and reads the same counts as
 * after one. The MCP provider is outside this: the mock has no `vscode.lm`,
 * which `registerMcpProvider` reads as a host without agent mode.
 */

function live() {
	return {
		commands: _registeredCommands().size,
		listeners: _configListenerCount(),
		statusBars: _statusBarItems().filter((item) => !item.disposed).length,
		channels: _outputChannels().filter((channel) => !channel.disposed).length,
		timers: vi.getTimerCount(),
	};
}

async function run(id: string): Promise<void> {
	const handler = _registeredCommands().get(id);
	if (!handler) throw new Error(`command not registered: ${id}`);
	await handler();
}

async function runEveryCommand(): Promise<void> {
	_setActiveEditor(
		_createDocument({ content: '[3, 1, 3]', fileName: '/mock/n.json' }),
	);
	await run('numbers-le.extractNumbers');
	_setActiveEditor(_createDocument({ content: '3\n1\n3' }));
	await run('numbers-le.postProcess.dedupe');
	_respondToQuickPick((items) =>
		(items as Array<{ value: string }>).find(
			(item) => item.value === 'numeric-asc',
		),
	);
	await run('numbers-le.postProcess.sort');
	await run('numbers-le.openSettings');
	await run('numbers-le.help');
}

describe('lifecycle', () => {
	beforeEach(() => {
		_resetMockState();
		vi.useFakeTimers();
		// Telemetry on, so the output channel exists and has to be released.
		_setConfig('numbers-le.telemetryEnabled', true);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('deactivation releases every command, listener, item, channel and timer', async () => {
		const context = _createExtensionContext();
		activate(context as never);
		await runEveryCommand();
		expect(live()).toEqual({
			commands: 5,
			listeners: 1,
			statusBars: 1,
			channels: 1,
			timers: 1,
		});

		for (const subscription of context.subscriptions) subscription.dispose();
		expect(live()).toEqual({
			commands: 0,
			listeners: 0,
			statusBars: 0,
			channels: 0,
			timers: 0,
		});

		// Safe to repeat.
		for (const subscription of context.subscriptions) subscription.dispose();
		expect(live().timers).toBe(0);
	});

	it('fifty rounds of every command leave the counts where one round left them', async () => {
		const context = _createExtensionContext();
		activate(context as never);
		await runEveryCommand();
		const afterOne = live();
		for (let round = 1; round < 50; round += 1) await runEveryCommand();
		expect(live()).toEqual(afterOne);
		expect(context.subscriptions.length).toBe(
			// three commands, settings, help, the telemetry, the status bar item,
			// its listener and its timer release: registered once at activation.
			9,
		);
	});
});
