import * as assert from 'node:assert';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as vscode from 'vscode';

const EXTENSION_ID = 'nolindnaidoo.numbers-le';

async function openFile(
	name: string,
	content: string,
): Promise<vscode.TextEditor> {
	const dir = mkdtempSync(join(tmpdir(), 'numbers-le-it-'));
	const filePath = join(dir, name);
	writeFileSync(filePath, content, 'utf8');
	const document = await vscode.workspace.openTextDocument(
		vscode.Uri.file(filePath),
	);
	return vscode.window.showTextDocument(document);
}

describe('Numbers-LE integration', function () {
	this.timeout(30_000);

	it('activates', async () => {
		const extension = vscode.extensions.getExtension(EXTENSION_ID);
		assert.ok(extension, `extension ${EXTENSION_ID} not found`);
		await extension.activate();
		assert.strictEqual(extension.isActive, true);
	});

	it('registers every declared command', async () => {
		const extension = vscode.extensions.getExtension(EXTENSION_ID);
		await extension?.activate();
		const commands = await vscode.commands.getCommands(true);
		for (const id of [
			'numbers-le.extractNumbers',
			'numbers-le.postProcess.dedupe',
			'numbers-le.postProcess.sort',
			'numbers-le.csv.toggleStreaming',
			'numbers-le.openSettings',
			'numbers-le.help',
		]) {
			assert.ok(commands.includes(id), `missing command: ${id}`);
		}
	});

	it('extracts numbers from a JSON file into a results document', async () => {
		await openFile(
			'data.json',
			'{"a": 1, "b": [2.5, -3], "s": "42", "nested": {"c": 0.001}}',
		);

		await vscode.commands.executeCommand('numbers-le.extractNumbers');

		const resultDoc = vscode.workspace.textDocuments.find(
			(doc) =>
				doc.languageId === 'plaintext' && doc.getText().startsWith('1\n2.5'),
		);
		assert.ok(resultDoc, 'no results document found');
		assert.deepStrictEqual(resultDoc.getText().split('\n'), [
			'1',
			'2.5',
			'-3',
			'0.001',
		]);
	});

	it('dedupe writes unique numbers to a new document', async () => {
		await openFile('numbers.txt', '5\n5\n6\n5');

		await vscode.commands.executeCommand('numbers-le.postProcess.dedupe');

		const resultDoc = vscode.workspace.textDocuments.find(
			(doc) => doc.languageId === 'plaintext' && doc.getText() === '5\n6',
		);
		assert.ok(resultDoc, 'no deduped results document found');
	});
});
