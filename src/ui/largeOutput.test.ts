import { beforeEach, describe, expect, it } from 'vitest';
import { _resetMockState, _respondToWarning } from '../__mocks__/vscode';
import { chooseLargeOutputAction, confirmManyDocuments } from './largeOutput';

beforeEach(() => {
	_resetMockState();
});

describe('chooseLargeOutputAction', () => {
	it('maps the three buttons to open/copy/cancel', async () => {
		_respondToWarning((items) =>
			(items as string[]).find((i) => i === 'Open results'),
		);
		expect(await chooseLargeOutputAction(100000)).toBe('open');

		_respondToWarning((items) =>
			(items as string[]).find((i) => i === 'Copy only'),
		);
		expect(await chooseLargeOutputAction(100000)).toBe('copy');

		_respondToWarning(() => undefined);
		expect(await chooseLargeOutputAction(100000)).toBe('cancel');
	});

	it('includes contextual notes only when asked', async () => {
		const { _shownMessages } = await import('../__mocks__/vscode');
		_respondToWarning(() => undefined);
		await chooseLargeOutputAction(5, true);
		await chooseLargeOutputAction(5, false);
		const [withNotes, without] = _shownMessages();
		expect(withNotes?.message).toContain('Notes:');
		expect(without?.message).not.toContain('Notes:');
	});
});

describe('confirmManyDocuments', () => {
	it('returns true only for an explicit confirmation', async () => {
		_respondToWarning((items) =>
			(items as string[]).find((i) => i === 'Open results'),
		);
		expect(await confirmManyDocuments(3, 500)).toBe(true);

		_respondToWarning(() => undefined);
		expect(await confirmManyDocuments(3, 500)).toBe(false);
	});
});
