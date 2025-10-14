import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock vscode module
vi.mock('vscode', async () => {
	const actual = await vi.importActual<typeof import('../__mocks__/vscode')>(
		'../__mocks__/vscode',
	);
	return actual;
});

import { commands, env, window } from 'vscode';
import { mockExtensionContext } from '../__mocks__/vscode';
import { registerCommands } from './index';

describe('analyze command', () => {
	const mockTelemetry = {
		event: vi.fn(),
		dispose: vi.fn(),
	};

	const mockNotifier = {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		dispose: vi.fn(),
	};

	const mockStatusBar = {
		show: vi.fn(),
		hide: vi.fn(),
		update: vi.fn(),
		dispose: vi.fn(),
	};

	const mockPerformanceMonitor = {
		startOperation: vi.fn().mockReturnValue({
			end: vi.fn().mockReturnValue({
				operation: 'test',
				startTime: Date.now(),
				endTime: Date.now(),
				duration: 100,
				numberCount: 0,
				fileSize: 0,
				memoryUsage: 0,
				cpuUsage: 0,
				throughput: 0,
				cacheHits: 0,
				cacheMisses: 0,
			}),
		}),
		recordMetrics: vi.fn(),
	};

	const mockDeps = {
		telemetry: mockTelemetry,
		notifier: mockNotifier,
		statusBar: mockStatusBar,
		performanceMonitor: mockPerformanceMonitor,
	};

	beforeEach(() => {
		vi.clearAllMocks();

		// Re-establish performance monitor mock after clearAllMocks
		mockPerformanceMonitor.startOperation.mockReturnValue({
			end: vi.fn().mockReturnValue({
				operation: 'test',
				startTime: Date.now(),
				endTime: Date.now(),
				duration: 100,
				numberCount: 0,
				fileSize: 0,
				memoryUsage: 0,
				cpuUsage: 0,
				throughput: 0,
				cacheHits: 0,
				cacheMisses: 0,
			}),
		});

		// Mock window.activeTextEditor
		(window.activeTextEditor as any) = {
			document: {
				getText: vi.fn().mockReturnValue('1,2,3,4,5,6,7,8,9,10'),
				fileName: '/test.txt',
			},
			edit: vi.fn(() => Promise.resolve(true)),
		};

		// Mock env.clipboard
		(env.clipboard.writeText as any).mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('registers analyze command', () => {
		registerCommands(mockExtensionContext as any, mockDeps);

		expect(commands.registerCommand).toHaveBeenCalledWith(
			'numbers-le.postProcess.analyze',
			expect.any(Function),
		);
	});

	it('analyzes numbers in active editor', async () => {
		const mockEditor = window.activeTextEditor as any;

		registerCommands(mockExtensionContext as any, mockDeps);
		const command = (commands.registerCommand as any).mock.calls.find(
			(call: any) => call[0] === 'numbers-le.postProcess.analyze',
		)[1];

		await command();

		// Should edit the document in-place with analysis report
		expect(mockEditor.edit).toHaveBeenCalled();
		// Should show analyzing message
		expect(mockNotifier.info).toHaveBeenCalled();
		// Should send telemetry
		expect(mockTelemetry.event).toHaveBeenCalledWith(
			'numbers.analyzed',
			expect.objectContaining({
				count: expect.any(String),
				outliers: expect.any(String),
			}),
		);
	});

	it('includes basic statistics in report', async () => {
		const mockEditor = {
			document: {
				getText: vi.fn().mockReturnValue('1,2,3,4,5,6,7,8,9,10'),
				positionAt: vi.fn((offset: number) => ({ line: 0, character: offset })),
				fileName: '/test.txt',
			},
			edit: vi.fn(() => Promise.resolve(true)),
		};
		(window.activeTextEditor as any) = mockEditor;

		let reportContent = '';
		mockEditor.edit.mockImplementation((callback: any) => {
			const editBuilder = {
				replace: vi.fn((range: any, text: string) => {
					reportContent = text;
				}),
			};
			callback(editBuilder);
			return Promise.resolve(true);
		});

		registerCommands(mockExtensionContext as any, mockDeps);
		const command = (commands.registerCommand as any).mock.calls.find(
			(call: any) => call[0] === 'numbers-le.postProcess.analyze',
		)[1];

		await command();

		// Check for basic statistics in the report
		expect(reportContent).toContain('Count:');
		expect(reportContent).toContain('Sum:');
		expect(reportContent).toContain('Average:');
		expect(reportContent).toContain('Median:');
		expect(reportContent).toContain('Min:');
		expect(reportContent).toContain('Max:');
		expect(reportContent).toContain('Range:');
	});

	it('includes advanced statistics in report', async () => {
		const mockEditor = {
			document: {
				getText: vi.fn().mockReturnValue('1,2,3,4,5,6,7,8,9,10'),
				positionAt: vi.fn((offset: number) => ({ line: 0, character: offset })),
				fileName: '/test.txt',
			},
			edit: vi.fn(() => Promise.resolve(true)),
		};
		(window.activeTextEditor as any) = mockEditor;

		let reportContent = '';
		mockEditor.edit.mockImplementation((callback: any) => {
			const editBuilder = {
				replace: vi.fn((range: any, text: string) => {
					reportContent = text;
				}),
			};
			callback(editBuilder);
			return Promise.resolve(true);
		});

		registerCommands(mockExtensionContext as any, mockDeps);
		const command = (commands.registerCommand as any).mock.calls.find(
			(call: any) => call[0] === 'numbers-le.postProcess.analyze',
		)[1];

		await command();

		// Check for advanced statistics in the report
		expect(reportContent).toContain('Standard Deviation:');
		expect(reportContent).toContain('Variance:');
		expect(reportContent).toContain('Outliers:');
	});

	it('handles no active editor gracefully', async () => {
		(window.activeTextEditor as any) = undefined;

		registerCommands(mockExtensionContext as any, mockDeps);
		const command = (commands.registerCommand as any).mock.calls.find(
			(call: any) => call[0] === 'numbers-le.postProcess.analyze',
		)[1];

		await command();

		// Should show warning
		expect(mockNotifier.warn).toHaveBeenCalled();
	});

	it('handles no numbers found gracefully', async () => {
		(window.activeTextEditor as any) = {
			document: {
				getText: vi.fn().mockReturnValue('no numbers here'),
				fileName: '/test.txt',
			},
			edit: vi.fn(() => Promise.resolve(true)),
		};

		registerCommands(mockExtensionContext as any, mockDeps);
		const command = (commands.registerCommand as any).mock.calls.find(
			(call: any) => call[0] === 'numbers-le.postProcess.analyze',
		)[1];

		await command();

		// Should show no numbers found message
		expect(mockNotifier.info).toHaveBeenCalled();
	});

	it('detects outliers when present', async () => {
		// Data with outliers: 1-10 and 1000 (outlier)
		const mockEditor = {
			document: {
				getText: vi.fn().mockReturnValue('1,2,3,4,5,6,7,8,9,10,1000'),
				positionAt: vi.fn((offset: number) => ({ line: 0, character: offset })),
				fileName: '/test.txt',
			},
			edit: vi.fn(() => Promise.resolve(true)),
		};
		(window.activeTextEditor as any) = mockEditor;

		let reportContent = '';
		mockEditor.edit.mockImplementation((callback: any) => {
			const editBuilder = {
				replace: vi.fn((range: any, text: string) => {
					reportContent = text;
				}),
			};
			callback(editBuilder);
			return Promise.resolve(true);
		});

		registerCommands(mockExtensionContext as any, mockDeps);
		const command = (commands.registerCommand as any).mock.calls.find(
			(call: any) => call[0] === 'numbers-le.postProcess.analyze',
		)[1];

		await command();

		// Should detect outlier
		expect(reportContent).toContain('Outliers:');
		// The outlier count should be reported to telemetry
		expect(mockTelemetry.event).toHaveBeenCalledWith(
			'numbers.analyzed',
			expect.objectContaining({
				outliers: expect.any(String),
			}),
		);
	});

	it('reports no outliers when none present', async () => {
		const mockEditor = {
			document: {
				getText: vi.fn().mockReturnValue('1,2,3,4,5'),
				positionAt: vi.fn((offset: number) => ({ line: 0, character: offset })),
				fileName: '/test.txt',
			},
			edit: vi.fn(() => Promise.resolve(true)),
		};
		(window.activeTextEditor as any) = mockEditor;

		let reportContent = '';
		mockEditor.edit.mockImplementation((callback: any) => {
			const editBuilder = {
				replace: vi.fn((range: any, text: string) => {
					reportContent = text;
				}),
			};
			callback(editBuilder);
			return Promise.resolve(true);
		});

		registerCommands(mockExtensionContext as any, mockDeps);
		const command = (commands.registerCommand as any).mock.calls.find(
			(call: any) => call[0] === 'numbers-le.postProcess.analyze',
		)[1];

		await command();

		expect(reportContent).toContain('Outliers: None detected');
	});

	it('includes file information in report', async () => {
		const mockEditor = {
			document: {
				getText: vi.fn().mockReturnValue('1,2,3,4,5,6,7,8,9,10'),
				positionAt: vi.fn((offset: number) => ({ line: 0, character: offset })),
				fileName: '/test.txt',
			},
			edit: vi.fn(() => Promise.resolve(true)),
		};
		(window.activeTextEditor as any) = mockEditor;

		let reportContent = '';
		mockEditor.edit.mockImplementation((callback: any) => {
			const editBuilder = {
				replace: vi.fn((range: any, text: string) => {
					reportContent = text;
				}),
			};
			callback(editBuilder);
			return Promise.resolve(true);
		});

		registerCommands(mockExtensionContext as any, mockDeps);
		const command = (commands.registerCommand as any).mock.calls.find(
			(call: any) => call[0] === 'numbers-le.postProcess.analyze',
		)[1];

		await command();

		expect(reportContent).toContain('File:');
		expect(reportContent).toContain('Type:');
		expect(reportContent).toContain('Numbers Found:');
	});

	it('analyzes numbers from JSON files', async () => {
		const mockEditor = {
			document: {
				getText: vi
					.fn()
					.mockReturnValue('{"values": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}'),
				positionAt: vi.fn((offset: number) => ({ line: 0, character: offset })),
				fileName: '/test.json',
			},
			edit: vi.fn(() => Promise.resolve(true)),
		};
		(window.activeTextEditor as any) = mockEditor;

		registerCommands(mockExtensionContext as any, mockDeps);
		const command = (commands.registerCommand as any).mock.calls.find(
			(call: any) => call[0] === 'numbers-le.postProcess.analyze',
		)[1];

		await command();

		// Should edit the document in-place with analysis report
		expect(mockEditor.edit).toHaveBeenCalled();
		// Should show notification
		expect(mockNotifier.info).toHaveBeenCalled();
	});
});
