import { describe, expect, test } from 'vitest';
import { extractFromCsv } from './csv';
import { extractFromEnv } from './env';
import { extractFromIni } from './ini';

describe('CSV/ENV/INI Security & Edge Cases', () => {
	describe('CSV Injection Prevention', () => {
		test('should handle CSV with formula injection attempts', () => {
			const csv = "=1+1,=SUM(A1:A10),=cmd|'/c calc'!A1";
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			// Should not execute formulas, just try to parse as numbers
			expect(result.numbers.length).toBe(0);
		});

		test('should handle CSV with command injection attempts', () => {
			const csv = '"; rm -rf /","; DROP TABLE users;","; cat /etc/passwd"';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			// Should safely ignore malicious strings
			expect(result.numbers.length).toBe(0);
		});

		test('should handle CSV with SQL injection attempts', () => {
			const csv = "1' OR '1'='1,'; DROP TABLE users; --,admin'--";
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			// Should extract the leading number from first cell
			expect(result.numbers).toContain(1);
		});

		test('should handle CSV with XSS attempts', () => {
			const csv = '<script>alert(1)</script>,<img src=x onerror=alert(1)>,42';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			// Should extract the valid number
			expect(result.numbers).toContain(42);
		});

		test('should handle CSV with path traversal attempts', () => {
			const csv = '../../etc/passwd,../../../root/.ssh/id_rsa,42';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			// Should extract the valid number
			expect(result.numbers).toContain(42);
		});

		test('should handle CSV with null bytes', () => {
			const csv = '1\x002,3\x004,5';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			// Should handle null bytes gracefully
			expect(result.numbers.length).toBeGreaterThan(0);
		});

		test('should handle CSV with Unicode control characters', () => {
			const csv = '1\u0000,2\u0001,3\u0002,4';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			// Should extract numbers despite control characters
			expect(result.numbers).toContain(4);
		});

		test('should handle CSV with very long lines', () => {
			const longValue = 'a'.repeat(10000);
			const csv = `${longValue},42,${longValue}`;
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			// Should extract the valid number
			expect(result.numbers).toContain(42);
		});

		test('should handle CSV with deeply nested quotes', () => {
			const csv = '"""1""","""2""","""3"""';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			// Should handle nested quotes
			expect(result.numbers.length).toBeGreaterThan(0);
		});

		test('should handle CSV with mixed encodings', () => {
			const csv = '1,2,3,文字,4,5';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			// Should extract numbers regardless of Unicode
			expect(result.numbers).toContain(1);
			expect(result.numbers).toContain(5);
		});
	});

	describe('ENV Injection Prevention', () => {
		test('should handle ENV with command injection attempts', () => {
			const env = 'CMD="; rm -rf /"\nEVIL=$(whoami)\nSAFE=42';
			const result = extractFromEnv(env, 'test.env');

			expect(result.success).toBe(true);
			// Should extract the valid number
			expect(result.numbers).toContain(42);
		});

		test('should handle ENV with shell expansion attempts', () => {
			const env = 'PATH=$PATH:/evil\nUSER=$(whoami)\nPORT=8080';
			const result = extractFromEnv(env, 'test.env');

			expect(result.success).toBe(true);
			// Should extract the valid number
			expect(result.numbers).toContain(8080);
		});

		test('should handle ENV with backtick expansion', () => {
			const env = 'CMD=`whoami`\nEVIL=`cat /etc/passwd`\nCOUNT=42';
			const result = extractFromEnv(env, 'test.env');

			expect(result.success).toBe(true);
			// Should extract the valid number
			expect(result.numbers).toContain(42);
		});

		test('should handle ENV with variable expansion', () => {
			const env = 'HOME=${HOME}\nUSER=${USER}\nPORT=8080';
			const result = extractFromEnv(env, 'test.env');

			expect(result.success).toBe(true);
			// Should extract the valid number
			expect(result.numbers).toContain(8080);
		});

		test('should handle ENV with newline injection', () => {
			const env = 'KEY=value\nwith\nnewlines\nPORT=8080';
			const result = extractFromEnv(env, 'test.env');

			expect(result.success).toBe(true);
			// Should extract the valid number
			expect(result.numbers).toContain(8080);
		});

		test('should handle ENV with null bytes', () => {
			const env = 'KEY=value\x00\nPORT=8080';
			const result = extractFromEnv(env, 'test.env');

			expect(result.success).toBe(true);
			// Should handle null bytes gracefully
			expect(result.numbers).toContain(8080);
		});

		test('should handle ENV with very long values', () => {
			const longValue = 'a'.repeat(10000);
			const env = `LONG=${longValue}\nPORT=8080`;
			const result = extractFromEnv(env, 'test.env');

			expect(result.success).toBe(true);
			// Should extract the valid number
			expect(result.numbers).toContain(8080);
		});

		test('should handle ENV with special characters in keys', () => {
			const env =
				'KEY-WITH-DASHES=42\nKEY_WITH_UNDERSCORES=43\nKEY.WITH.DOTS=44';
			const result = extractFromEnv(env, 'test.env');

			expect(result.success).toBe(true);
			// Should extract valid numbers
			expect(result.numbers.length).toBeGreaterThan(0);
		});

		test('should handle ENV with export statements', () => {
			const env = 'export PORT=8080\nexport TIMEOUT=30';
			const result = extractFromEnv(env, 'test.env');

			expect(result.success).toBe(true);
			// dotenv parser should handle export
			expect(result.numbers.length).toBeGreaterThan(0);
		});

		test('should handle ENV with multiline values', () => {
			const env = 'KEY="value\nwith\nnewlines"\nPORT=8080';
			const result = extractFromEnv(env, 'test.env');

			expect(result.success).toBe(true);
			// Should extract the valid number
			expect(result.numbers).toContain(8080);
		});
	});

	describe('INI Injection Prevention', () => {
		test('should handle INI with command injection attempts', () => {
			const ini = '[section]\ncmd="; rm -rf /"\nevil=$(whoami)\nsafe=42';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			// Should extract the valid number
			expect(result.numbers).toContain(42);
		});

		test('should handle INI with SQL injection attempts', () => {
			const ini = "[section]\nquery=1' OR '1'='1\ncount=42";
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			// Should extract the valid number
			expect(result.numbers).toContain(42);
		});

		test('should handle INI with path traversal attempts', () => {
			const ini = '[section]\npath=../../etc/passwd\ncount=42';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			// Should extract the valid number
			expect(result.numbers).toContain(42);
		});

		test('should handle INI with null bytes', () => {
			const ini = '[section]\nkey=value\x00\ncount=42';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			// Should handle null bytes gracefully
			expect(result.numbers).toContain(42);
		});

		test('should handle INI with very long section names', () => {
			const longSection = 'a'.repeat(1000);
			const ini = `[${longSection}]\ncount=42`;
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			// Should extract the valid number
			expect(result.numbers).toContain(42);
		});

		test('should handle INI with very long values', () => {
			const longValue = 'a'.repeat(10000);
			const ini = `[section]\nlong=${longValue}\ncount=42`;
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			// Should extract the valid number
			expect(result.numbers).toContain(42);
		});

		test('should handle INI with duplicate sections', () => {
			const ini = '[section]\ncount=42\n[section]\ncount=43';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			// Should extract numbers from both sections
			expect(result.numbers.length).toBeGreaterThan(0);
		});

		test('should handle INI with duplicate keys', () => {
			const ini = '[section]\ncount=42\ncount=43\ncount=44';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			// Should extract numbers (behavior depends on ini parser)
			expect(result.numbers.length).toBeGreaterThan(0);
		});

		test('should handle INI with special characters in section names', () => {
			const ini =
				'[section-with-dashes]\ncount=42\n[section_with_underscores]\ncount=43';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			// Should extract valid numbers
			expect(result.numbers).toContain(42);
			expect(result.numbers).toContain(43);
		});

		test('should handle INI with nested sections (if supported)', () => {
			const ini = '[parent]\ncount=42\n[parent.child]\ncount=43';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			// Should extract valid numbers
			expect(result.numbers.length).toBeGreaterThan(0);
		});
	});

	describe('Edge Cases - Infinity and Special Values', () => {
		test('should reject Infinity in CSV', () => {
			const csv = 'Infinity,-Infinity,42';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			// Should only extract finite numbers
			expect(result.numbers).toContain(42);
			expect(result.numbers).not.toContain(Infinity);
			expect(result.numbers).not.toContain(-Infinity);
		});

		test('should reject Infinity in ENV', () => {
			const env = 'INF=Infinity\nNEG_INF=-Infinity\nVALID=42';
			const result = extractFromEnv(env, 'test.env');

			expect(result.success).toBe(true);
			// Should only extract finite numbers
			expect(result.numbers).toContain(42);
			expect(result.numbers).not.toContain(Infinity);
			expect(result.numbers).not.toContain(-Infinity);
		});

		test('should reject Infinity in INI', () => {
			const ini = '[section]\ninf=Infinity\nneg_inf=-Infinity\nvalid=42';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			// Should only extract finite numbers
			expect(result.numbers).toContain(42);
			expect(result.numbers).not.toContain(Infinity);
			expect(result.numbers).not.toContain(-Infinity);
		});

		test('should reject NaN in CSV', () => {
			const csv = 'NaN,42,NaN';
			const result = extractFromCsv(csv, 'test.csv');

			expect(result.success).toBe(true);
			// Should only extract valid numbers
			expect(result.numbers).toContain(42);
			expect(result.numbers.every((n) => !Number.isNaN(n))).toBe(true);
		});

		test('should reject NaN in ENV', () => {
			const env = 'NAN=NaN\nVALID=42';
			const result = extractFromEnv(env, 'test.env');

			expect(result.success).toBe(true);
			// Should only extract valid numbers
			expect(result.numbers).toContain(42);
			expect(result.numbers.every((n) => !Number.isNaN(n))).toBe(true);
		});

		test('should reject NaN in INI', () => {
			const ini = '[section]\nnan=NaN\nvalid=42';
			const result = extractFromIni(ini, 'test.ini');

			expect(result.success).toBe(true);
			// Should only extract valid numbers
			expect(result.numbers).toContain(42);
			expect(result.numbers.every((n) => !Number.isNaN(n))).toBe(true);
		});
	});

	describe('Edge Cases - Malformed Input', () => {
		test('should handle malformed CSV gracefully', () => {
			const csv = '1,2,"unclosed quote\n3,4,5';
			const result = extractFromCsv(csv, 'test.csv');

			// Should either succeed or fail gracefully
			expect(result.success === true || result.success === false).toBe(true);
			if (result.success) {
				expect(result.numbers.length).toBeGreaterThan(0);
			} else {
				expect(result.errors.length).toBeGreaterThan(0);
			}
		});

		test('should handle malformed ENV gracefully', () => {
			const env = 'KEY=value\nMALFORMED\nPORT=8080';
			const result = extractFromEnv(env, 'test.env');

			// dotenv parser should handle this
			expect(result.success).toBe(true);
		});

		test('should handle malformed INI gracefully', () => {
			const ini = '[section\nkey=value\ncount=42';
			const result = extractFromIni(ini, 'test.ini');

			// ini parser should handle this
			expect(result.success === true || result.success === false).toBe(true);
		});
	});

	describe('Immutability Verification', () => {
		test('should return frozen arrays in CSV', () => {
			const csv = '1,2,3';
			const result = extractFromCsv(csv, 'test.csv');

			expect(Object.isFrozen(result.numbers)).toBe(true);
			expect(Object.isFrozen(result.errors)).toBe(true);
		});

		test('should return frozen arrays in ENV', () => {
			const env = 'PORT=8080';
			const result = extractFromEnv(env, 'test.env');

			expect(Object.isFrozen(result.numbers)).toBe(true);
			expect(Object.isFrozen(result.errors)).toBe(true);
		});

		test('should return frozen arrays in INI', () => {
			const ini = '[section]\ncount=42';
			const result = extractFromIni(ini, 'test.ini');

			expect(Object.isFrozen(result.numbers)).toBe(true);
			expect(Object.isFrozen(result.errors)).toBe(true);
		});
	});
});
