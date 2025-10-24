import * as nls from 'vscode-nls';

// Configure localization to use the i18n directory
const localize = nls.config({
	messageFormat: nls.MessageFormat.file,
	bundleFormat: nls.BundleFormat.standalone,
})();

export { localize };
