import { defineConfig } from 'rolldown';

/**
 * pm-tool CLIツールとプラグインのバンドル設定
 *
 * プラグインは完全に独立したバンドルとして生成され、
 * 共通コードも各プラグイン内に含まれる
 */
export default defineConfig([
  // コアCLI
  {
    input: '_tools/lib/pm-tool/cli.js',
    output: {
      file: '_tools/pm-tool',
      format: 'esm',
    },
    external: [
      'zx',
      'fs',
      'path',
      'url',
      'node:fs',
      'node:path',
      'node:url',
    ],
    resolve: {
      extensions: ['.js'],
    },
  },
  // Redmineプラグイン（独立バンドル）
  {
    input: '_tools/lib/pm-tool/plugins/redmine/index.js',
    output: {
      file: '_tools/lib/pm-tool/plugins/redmine.mjs',
      format: 'esm',
    },
    external: [
      'zx',
    ],
    resolve: {
      extensions: ['.js'],
    },
  },
  // Backlogプラグイン（独立バンドル）
  {
    input: '_tools/lib/pm-tool/plugins/backlog/index.js',
    output: {
      file: '_tools/lib/pm-tool/plugins/backlog.mjs',
      format: 'esm',
    },
    external: [
      'zx',
    ],
    resolve: {
      extensions: ['.js'],
    },
  },
]);
