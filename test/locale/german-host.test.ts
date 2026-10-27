import * as assert from 'node:assert';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as vscode from 'vscode';

/**
 * The extension under a real host running in German.
 *
 * `test/integration/l10n.test.ts` holds the catalogues complete and in parity,
 * and says why it cannot show that either mechanism loads: `vscode.l10n.t`
 * resolves against the extension that calls it, and a test file is its own
 * extension with an empty bundle. This extension's results document holds
 * numbers and nothing else, and every runtime string goes to a notification,
 * the status bar or a quick pick, none of which a test can read back — so
 * what a German host can show is narrower than for an extension that writes
 * a report: that it activates and registers every command there, that the
 * host is German, and that the German bundle sits where the host loads it
 * from, as the manifest's `l10n` field names it.
 *
 * Launched by the `german host` config in `.vscode-test.mjs`, with
 * `--locale=de` and the German language pack installed into the test profile.
 */
describe('Numbers-LE in a German host', function () {
	this.timeout(60_000);

	it('runs in German', () => {
		assert.strictEqual(vscode.env.language, 'de');
	});

	it('activates and registers every command', async () => {
		const extension = vscode.extensions.getExtension('nolindnaidoo.numbers-le');
		assert.ok(extension, 'extension not found');
		await extension.activate();
		const commands = await vscode.commands.getCommands(true);
		for (const id of [
			'numbers-le.extractNumbers',
			'numbers-le.postProcess.dedupe',
			'numbers-le.postProcess.sort',
			'numbers-le.openSettings',
			'numbers-le.help',
		]) {
			assert.ok(commands.includes(id), `missing command: ${id}`);
		}
	});

	it('ships the German runtime bundle where the manifest tells the host to look', () => {
		const extension = vscode.extensions.getExtension('nolindnaidoo.numbers-le');
		assert.ok(extension, 'extension not found');
		const l10n = (extension.packageJSON as { l10n?: string }).l10n;
		assert.strictEqual(l10n, './l10n');
		const bundle = join(extension.extensionPath, l10n, 'bundle.l10n.de.json');
		assert.ok(existsSync(bundle), `no German bundle at ${bundle}`);
	});
});
