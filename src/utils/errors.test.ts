import { describe, expect, it } from 'vitest';
import { sanitizeErrorMessage } from './errors';

describe('sanitizeErrorMessage', () => {
	it('redacts user directories', () => {
		expect(sanitizeErrorMessage('ENOENT /Users/alice/project/data.json')).toBe(
			'ENOENT /Users/***/project/data.json',
		);
		expect(sanitizeErrorMessage('read /home/bob/x failed')).toBe(
			'read /home/***/x failed',
		);
		expect(sanitizeErrorMessage('open C:\\Users\\carol\\f.csv')).toBe(
			'open C:\\Users\\***\\f.csv',
		);
	});

	it('redacts credential-shaped fragments', () => {
		expect(sanitizeErrorMessage('auth password: hunter2 rejected')).toBe(
			'auth password=*** rejected',
		);
		expect(sanitizeErrorMessage('token=abc123')).toBe('token=***');
		expect(sanitizeErrorMessage('api key: xyz')).toBe('api key=***');
	});

	it('leaves ordinary messages alone', () => {
		expect(sanitizeErrorMessage('Failed to parse JSON: bad input')).toBe(
			'Failed to parse JSON: bad input',
		);
	});
});
