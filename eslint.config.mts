import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { globalIgnores } from 'eslint/config';

export default tseslint.config(
	globalIgnores([
		'node_modules',
		'dist',
		'esbuild.config.mjs',
		'version-bump.mjs',
		'versions.json',
		'main.js',
		'package.json',
		'package-lock.json',
		'tsconfig.json',
		'assets',
	]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.mts', 'manifest.json'],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		rules: {
			'obsidianmd/no-static-styles-assignment': 'off',
			'obsidianmd/no-forbidden-elements': 'off',
			'obsidianmd/prefer-active-doc': 'off',
			'obsidianmd/prefer-window-timers': 'off',
			'obsidianmd/ui/sentence-case': 'off',
			'obsidianmd/no-unsupported-api': 'off',
			'obsidianmd/detach-leaves': 'off',
			'obsidianmd/settings-tab/no-manual-html-headings': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-floating-promises': 'off',
			'@typescript-eslint/no-misused-promises': 'off',
			'@typescript-eslint/no-unnecessary-type-assertion': 'off',
			'@typescript-eslint/no-deprecated': 'off',
			'no-useless-escape': 'off',
			'@microsoft/sdl/no-inner-html': 'off',
		},
	},
);
