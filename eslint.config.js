import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

// 日本語（ひらがな・カタカナ・漢字）を含む文字列
const JA = '/[\\u3040-\\u30ff\\u4e00-\\u9faf]/';

export default tseslint.config(
  {
    ignores: ['dist', 'dev-dist', 'coverage', 'playwright-report', 'test-results', 'blob-report', 'node_modules'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  // §11.4 ドメイン層: React・Dexie・db・ui に依存しない。現在時刻を自分で取らない
  {
    files: ['src/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react/*', 'react-dom', 'react-dom/*', 'react-router', 'dexie', 'dexie-react-hooks'],
              message: 'src/domain は React と Dexie に依存できません（§11.4）',
            },
            { group: ['**/db', '**/db/**', '**/ui', '**/ui/**'], message: 'src/domain から db と ui は使えません（§11.4）' },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message: 'src/domain では Date.now() を使わず、現在時刻を引数で受け取ります（§11.4）',
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'src/domain では引数なしの new Date() を使いません（§11.4）',
        },
      ],
    },
  },
  // §11.4 UI 層: DB を直接触らない。日本語を JSX に直接書かない
  {
    files: ['src/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/db/db', '**/db/db.ts', '**/db/hooks', '**/db/ledger', 'dexie'],
              message: '画面は db/repo と db/queries を通します（§11.4）',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: `JSXText[value=${JA}]`,
          message: 'UI 文言は src/copy/ja.ts に置きます（§11.4）',
        },
        {
          selector: `JSXAttribute > Literal[value=${JA}]`,
          message: 'UI 文言は src/copy/ja.ts に置きます（§11.4）',
        },
        {
          selector: `JSXExpressionContainer > Literal[value=${JA}]`,
          message: 'UI 文言は src/copy/ja.ts に置きます（§11.4）',
        },
      ],
    },
  },
);
