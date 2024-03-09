module.exports = {
	parser: '@typescript-eslint/parser',
	globals: {
		"NodeJS": true
	},
	extends: [
		'eslint:recommended',
		'plugin:@typescript-eslint/eslint-recommended',
		'plugin:@typescript-eslint/recommended',
		'airbnb/base',
		'plugin:import/recommended',
		'plugin:import/typescript',
		// 'plugin:jest/recommended'
	],
    ignorePatterns: ['node_modules', '*.html'],
	plugins: [
		// 'jest',
		'@typescript-eslint',
		'import'
	],
	env: {
		'browser': false,
		'node': true,
		// 'jest/globals': true,
	},
	parserOptions: {
		sourceType: 'module',
		ecmaVersion: 8,
		requireConfigFile: false,
		ecmaFeatures: {
			modules: true
		}
	},
	settings: {
		'import/resolver': {
			'node': {
				'extensions': ['.js', '.jsx', '.ts', '.tsx']
			}
		}
	},
	rules: {
		'indent': ['error', 'tab'],
		'no-tabs': 0,
		'@typescript-eslint/consistent-type-imports': [
			'error',
			{
				disallowTypeAnnotations: true,
				fixStyle: 'inline-type-imports',
				prefer: 'type-imports',
			},
		],
		'import/extensions': [
			'error',
			'ignorePackages',
			{
				'ts': 'never',
				'json': 'always'
			}
		],
		'max-len': [
			'error',
			{
				code: 120
			}
		],
		'import/prefer-default-export': 0,
		'import/no-unresolved': [
			'error',
			{
				ignore: ['\\?raw$']
			}
		],
		'no-console': 'error',
		'sort-imports': [
			'warn',
			{
				ignoreCase: false,
				ignoreDeclarationSort: true, // don't want to sort import lines, use eslint-plugin-import instead
				ignoreMemberSort: false,
				memberSyntaxSortOrder: ['none', 'all', 'multiple', 'single'],
				allowSeparatedGroups: true,
			},
		],
		'import/order': [
			'error',
			{
				groups: [
					'builtin', // Built-in imports (come from NodeJS native) go first
					'external', // <- External imports
					'internal', // <- Absolute imports
					['sibling', 'parent'], // <- Relative imports, the sibling and parent types they can be mingled together
					'index', // <- index imports
					'unknown', // <- unknown
				],
				'newlines-between': 'always',
				alphabetize: {
					/* sort in ascending order. Options: ['ignore', 'asc', 'desc'] */
					order: 'asc',
					/* ignore case. Options: [true, false] */
					caseInsensitive: true,
				},
			},
		],
		'function-paren-newline': [
			'error',
			{
				minItems: 3,
			}
		],
		'comma-dangle': [
			'error',
			{
				"arrays": "always",
				"objects": "never",
				"imports": "never",
				"exports": "never",
				"functions": "never"
			}
		],
	}
}
