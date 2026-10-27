import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	_createExtensionContext,
	_fireConfigChange,
	_resetMockState,
	_setConfig,
	_shownMessages,
	_statusBarItems,
} from '../__mocks__/vscode';
import { createNotifier } from './notifier';
import { createStatusBar } from './statusBar';

beforeEach(() => {
	_resetMockState();
});

describe('notifier levels', () => {
	it('silent (the default) suppresses info and warnings but shows errors', () => {
		const notifier = createNotifier();
		notifier.info('i');
		notifier.warn('w');
		notifier.error('e');
		expect(_shownMessages().map((m) => m.kind)).toEqual(['error']);
	});

	it('important shows warnings and errors, not info', () => {
		_setConfig('numbers-le.notificationsLevel', 'important');
		const notifier = createNotifier();
		notifier.info('i');
		notifier.warn('w');
		notifier.error('e');
		expect(_shownMessages().map((m) => m.kind)).toEqual(['warning', 'error']);
	});

	it('all shows everything', () => {
		_setConfig('numbers-le.notificationsLevel', 'all');
		const notifier = createNotifier();
		notifier.info('i');
		notifier.warn('w');
		notifier.error('e');
		expect(_shownMessages().map((m) => m.kind)).toEqual([
			'info',
			'warning',
			'error',
		]);
	});

	it('sanitizes every outgoing message', () => {
		const notifier = createNotifier();
		notifier.error('failed for /Users/alice/f with token=secret');
		expect(_shownMessages()[0]?.message).toBe(
			'failed for /Users/***/f with token=***',
		);
	});
});

describe('status bar', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	// These asserted nothing: a status bar that never showed, never hid and
	// never restored its label passed every one of them.
	it('shows by default and hides when disabled', () => {
		const context = _createExtensionContext();
		createStatusBar(context as never);
		const item = _statusBarItems()[0];
		expect(item?.visible).toBe(true);
		expect(item?.command).toBe('numbers-le.extractNumbers');

		_setConfig('numbers-le.statusBar.enabled', false);
		_fireConfigChange('numbers-le.statusBar.enabled');
		expect(item?.visible).toBe(false);

		_setConfig('numbers-le.statusBar.enabled', true);
		_fireConfigChange('numbers-le.statusBar.enabled');
		expect(item?.visible).toBe(true);
	});

	it('flash shows the text for two seconds and then restores the label', () => {
		vi.useFakeTimers();
		const statusBar = createStatusBar(_createExtensionContext() as never);
		const item = _statusBarItems()[0];
		statusBar.flash('Extracted 3');
		expect(item?.text).toBe('$(symbol-number) Extracted 3');
		vi.advanceTimersByTime(1999);
		expect(item?.text).toBe('$(symbol-number) Extracted 3');
		vi.advanceTimersByTime(1);
		expect(item?.text).toBe('$(symbol-number) Numbers-LE');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('a second flash replaces the first and its timer', () => {
		vi.useFakeTimers();
		const statusBar = createStatusBar(_createExtensionContext() as never);
		const item = _statusBarItems()[0];
		statusBar.flash('one');
		vi.advanceTimersByTime(1500);
		statusBar.flash('two');
		vi.advanceTimersByTime(600);
		expect(item?.text).toBe('$(symbol-number) two');
		expect(vi.getTimerCount()).toBe(1);
	});

	it('flash is a no-op when the status bar is disabled', () => {
		vi.useFakeTimers();
		_setConfig('numbers-le.statusBar.enabled', false);
		const statusBar = createStatusBar(_createExtensionContext() as never);
		statusBar.flash('nope');
		expect(_statusBarItems()[0]?.text).toBe('$(symbol-number) Numbers-LE');
		expect(vi.getTimerCount()).toBe(0);
	});

	it('disposing the subscriptions clears a pending flash, the listener and the item', () => {
		vi.useFakeTimers();
		const context = _createExtensionContext();
		const statusBar = createStatusBar(context as never);
		statusBar.flash('Extracted 3');
		expect(vi.getTimerCount()).toBe(1);

		for (const subscription of context.subscriptions) subscription.dispose();
		expect(vi.getTimerCount()).toBe(0);
		expect(_statusBarItems()[0]?.disposed).toBe(true);

		// The configuration listener went with the subscriptions.
		_setConfig('numbers-le.statusBar.enabled', false);
		_fireConfigChange('numbers-le.statusBar.enabled');
		expect(_statusBarItems()[0]?.visible).toBe(true);
	});
});
