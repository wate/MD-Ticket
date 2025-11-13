#!/usr/bin/env zx

import { getPmToolConfig } from './config.js';
import { info, error as logError, debug } from './common/logger.js';
import { PmToolError } from './common/error.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * 使用方法を表示する
 */
function showUsage() {
    console.log(`
使用方法:
  pm-tool fetch <チケット番号>        チケット情報を取得する
  pm-tool update <ファイルパス>       チケット情報を更新する
  pm-tool help                         ヘルプを表示する

オプション:
  --help, -h                           ヘルプを表示する
  --version, -v                        バージョンを表示する
  --dry-run                            実際の更新を行わず、ペイロードのみ表示する

環境変数:
  PM_TOOL_LOG_LEVEL                    ログレベル (DEBUG, INFO, WARN, ERROR)
                                       デフォルト: INFO

例:
  pm-tool fetch 1234
  pm-tool fetch https://redmine.example.com/issues/1234
  pm-tool update ticket-1234.md
  pm-tool update ticket-1234.md --dry-run
  pm-tool update ticket-1234.md --comment "実装完了"
    `.trim());
}

/**
 * バージョン情報を表示する
 */
function showVersion() {
    console.log('pm-tool version 0.1.0');
}

/**
 * プラグインを読み込む
 * バンドル済みプラグイン（lib/pm-tool/plugins/{toolName}.mjs）を動的にロードする
 *
 * @param {string} toolName - ツール名
 * @returns {Promise<Object>} プラグインオブジェクト
 */
async function loadPlugin(toolName) {
    try {
        const plugin = await import(`./lib/pm-tool/plugins/${toolName}.mjs`);
        return plugin.default || plugin;
    } catch (error) {
        throw new PmToolError(
            `プラグイン "${toolName}" の読み込みに失敗しました`,
            'PLUGIN_LOAD_ERROR',
            { toolName, originalError: error.message }
        );
    }
}

/**
 * URLからチケット番号を抽出する
 *
 * @param {string} input - チケット番号またはURL
 * @param {string} configUrl - config.ymlで設定されたURL
 * @returns {string} チケット番号
 * @throws {PmToolError} URL不一致またはチケット番号抽出失敗
 */
function parseTicketIdFromUrl(input, configUrl) {
    // URL形式でない場合はそのまま返す
    if (!input.startsWith('http://') && !input.startsWith('https://')) {
        return input;
    }

    try {
        const inputUrl = new URL(input);
        const baseUrl = new URL(configUrl);

        // プロトコル、ホスト、ポートが一致するか確認
        if (inputUrl.protocol !== baseUrl.protocol ||
            inputUrl.hostname !== baseUrl.hostname ||
            inputUrl.port !== baseUrl.port) {
            throw new PmToolError(
                `URLが設定と一致しません\n設定: ${configUrl}\n入力: ${input}`,
                'URL_MISMATCH',
                { configUrl, inputUrl: input }
            );
        }

        // パスからチケット番号を抽出（Redmine形式: /issues/123 または /issues/123.json）
        const match = inputUrl.pathname.match(/\/issues\/(\d+)/);
        if (!match) {
            throw new PmToolError(
                `URLからチケット番号を抽出できませんでした: ${input}`,
                'INVALID_URL_FORMAT',
                { url: input }
            );
        }

        return match[1];
    } catch (error) {
        if (error instanceof PmToolError) {
            throw error;
        }
        throw new PmToolError(
            `不正なURL形式です: ${input}`,
            'INVALID_URL',
            { url: input, originalError: error.message }
        );
    }
}

/**
 * Markdown形式にフォーマットする
 *
 * @param {Object} data - チケットデータ
 * @returns {string} Markdown形式の文字列
 */
function formatMarkdown(data) {
    const { meta, title, body } = data;

    // YAMLフロントマター
    const yamlFrontmatter = YAML.stringify(meta);

    // Markdown本文（タイトルはsetext記法のh1）
    const titleLine = title || 'Untitled';
    const titleUnderline = '='.repeat(Math.max(titleLine.length, 25));

    return `---
${yamlFrontmatter.trim()}
---
${titleLine}
${titleUnderline}

${body}
`;
}

/**
 * fetchコマンドを実行する
 *
 * @param {string} ticketIdOrUrl - チケットIDまたはURL
 * @param {Object} options - オプション
 */
async function executeFetch(ticketIdOrUrl, options = {}) {
    if (!ticketIdOrUrl) {
        throw new PmToolError('チケット番号またはURLを指定してください', 'INVALID_ARGUMENT');
    }

    const { tool, config, pmToolConfig } = getPmToolConfig();

    // URLからチケット番号を抽出（URL形式でない場合はそのまま使用）
    const ticketId = parseTicketIdFromUrl(ticketIdOrUrl, config.url);

    info(`チケット ${ticketId} の情報を取得します...`);

    const plugin = await loadPlugin(tool);

    // プラグインのfetchメソッドを呼び出し
    const result = await plugin.fetch(config, ticketId, options);

    info('チケット情報の取得に成功しました');

    // 標準出力モード（ファイル保存なし）
    if (options.stdout) {
        if (options.json) {
            // JSON形式で標準出力
            console.log(JSON.stringify(result, null, 2));
        } else {
            // Markdown形式で標準出力
            const markdown = formatMarkdown(result);
            console.log(markdown);
        }
        return result;
    }

    const outputDir = options.dir || pmToolConfig.output_dir || '.';
    const prefix = options.prefix || pmToolConfig.file_prefix || plugin.defaults?.file_prefix || '';

    // JSON形式で保存
    if (options.json) {
        const filename = `${prefix}${ticketId}.json`;
        const filepath = resolve(outputDir, filename);
        writeFileSync(filepath, JSON.stringify(result, null, 2), 'utf8');
        info(`JSONファイルを保存しました: ${filepath}`);
        return result;
    }

    // Markdown形式で保存（デフォルト）
    const filename = `${prefix}${ticketId}.md`;
    const filepath = resolve(outputDir, filename);
    const markdown = formatMarkdown(result);
    writeFileSync(filepath, markdown, 'utf8');
    info(`Markdownファイルを保存しました: ${filepath}`);

    return result;
}

/**
 * updateコマンドを実行する
 *
 * @param {string} filePath - チケットファイルパス
 * @param {Object} options - オプション
 */
async function executeUpdate(filePath, options = {}) {
    if (!filePath) {
        throw new PmToolError('チケットファイルパスを指定してください', 'INVALID_ARGUMENT');
    }

    // ファイルの存在確認
    if (!existsSync(filePath)) {
        throw new PmToolError(`ファイルが見つかりません: ${filePath}`, 'FILE_NOT_FOUND');
    }

    const { tool, config } = getPmToolConfig();

    // ファイルを読み込んでYAMLフロントマターをパース
    const fileContent = readFileSync(filePath, 'utf8');
    const frontmatterMatch = fileContent.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/);

    if (!frontmatterMatch) {
        throw new PmToolError('YAMLフロントマターが見つかりません', 'INVALID_FORMAT');
    }

    const frontmatter = YAML.parse(frontmatterMatch[1]);
    const bodyContent = frontmatterMatch[2].trim();

    // チケットIDを取得
    const ticketId = frontmatter.id;
    if (!ticketId) {
        throw new PmToolError('YAMLフロントマターにidが含まれていません', 'INVALID_FORMAT');
    }

    info(`チケット ${ticketId} を更新します...`);
    const plugin = await loadPlugin(tool);

    // 更新データを構築（コマンドラインオプション、YAMLフロントマター、本文を渡す）
    const updateData = {
        ...options, // コマンドラインオプションで指定された値
        frontmatter, // YAMLフロントマター全体
        body: bodyContent, // Markdown本文
        ticketId // チケットID
    };

    // プラグインのupdateメソッドを呼び出し（フィールド抽出はプラグイン側で実施）
    const result = await plugin.update(config, ticketId, updateData);

    info('チケットの更新に成功しました');
    console.log(JSON.stringify(result, null, 2));

    return result;
}

/**
 * コマンドライン引数をパースする
 *
 * @param {string[]} args - コマンドライン引数
 * @returns {Object} パースされた引数
 */
function parseArgs(args) {
    const parsed = {
        command: null,
        ticketId: null,
        options: {}
    };

    let i = 0;
    while (i < args.length) {
        const arg = args[i];

        // ヘルプオプション
        if (arg === '--help' || arg === '-h' || arg === 'help') {
            parsed.command = 'help';
            break;
        }

        // バージョンオプション
        if (arg === '--version' || arg === '-v') {
            parsed.command = 'version';
            break;
        }

        // コマンド
        if (!parsed.command && !arg.startsWith('-')) {
            parsed.command = arg;
            i++;
            continue;
        }

        // チケットID
        if (parsed.command && !parsed.ticketId && !arg.startsWith('-')) {
            parsed.ticketId = arg;
            i++;
            continue;
        }

        // オプション
        if (arg.startsWith('--')) {
            const key = arg.substring(2);
            const nextArg = args[i + 1];

            if (nextArg && !nextArg.startsWith('-')) {
                parsed.options[key] = nextArg;
                i += 2;
            } else {
                parsed.options[key] = true;
                i++;
            }
        } else {
            i++;
        }
    }

    return parsed;
}

/**
 * メイン処理
 */
async function main() {
    try {
        // zxスクリプトとして実行される場合、process.argvの構造が異なる
        // process.argv[0] = node, process.argv[1] = zx, process.argv[2] = スクリプトパス, process.argv[3]以降 = 実引数
        // または process.argv[0] = node, process.argv[1] = スクリプトパス, process.argv[2]以降 = 実引数
        let args = process.argv.slice(2);

        // 最初の引数がスクリプトパス自体の場合はスキップ
        if (args.length > 0 && (args[0].endsWith('/pm-tool') || args[0].includes('pm-tool'))) {
            args = args.slice(1);
        }

        const { command, ticketId, options } = parseArgs(args);

        // コマンドが指定されていない場合
        if (!command) {
            showUsage();
            process.exit(1);
        }

        // コマンド実行
        switch (command) {
            case 'help':
                showUsage();
                break;

            case 'version':
                showVersion();
                break;

            case 'fetch':
                await executeFetch(ticketId, options);
                break;

            case 'update':
                await executeUpdate(ticketId, options);
                break;

            default:
                console.error(`エラー: 不明なコマンド "${command}"`);
                showUsage();
                process.exit(1);
        }
    } catch (error) {
        logError('コマンド実行エラー', error);

        if (error instanceof PmToolError) {
            console.error(`\nエラー: ${error.message}`);
            if (error.details) {
                console.error('詳細:', JSON.stringify(error.details, null, 2));
            }
        } else {
            console.error(`\n予期しないエラーが発生しました: ${error.message}`);
        }

        process.exit(1);
    }
}

// メイン処理を実行
main();
