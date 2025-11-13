#!/usr/bin/env zx

import { getPmToolConfig } from './config.js';
import { info, error as logError, debug } from './common/logger.js';
import { PmToolError } from './common/error.js';

// zx内包のモジュール(fs, path)はimport不要
// グローバルに利用可能: fs, path, os, YAML, chalk, argv, glob, which, etc.

/**
 * 使用方法を表示する
 *
 * @param {Object} plugin - プラグインオブジェクト（オプション）
 */
function showUsage(plugin = null) {
    let usageText = `
使用方法:
  pm-tool fetch <チケット番号>        チケット情報を取得する
  pm-tool update <ファイルパス>       チケット情報を更新する
  pm-tool help                         ヘルプを表示する

オプション:
  --help, -h                           ヘルプを表示する
  --version, -v                        バージョンを表示する
  --dry-run                            実際の更新を行わず、ペイロードのみ表示する

fetchコマンド用オプション:
  --stdout                             ファイル保存せず標準出力に表示する
  --json                               JSON形式で保存/出力する
  --dir <ディレクトリ>                 出力ディレクトリを指定する
  --prefix <プレフィックス>            ファイル名のプレフィックスを指定する

環境変数:
  PM_TOOL_LOG_LEVEL                    ログレベル (DEBUG, INFO, WARN, ERROR)
                                       デフォルト: INFO`;

    // プラグイン固有のオプションを追加
    if (plugin && typeof plugin.getUpdateOptions === 'function') {
        const options = plugin.getUpdateOptions();
        if (options && options.length > 0) {
            usageText += `\n\n${plugin.label}固有の更新オプション:`;
            for (const opt of options) {
                const padding = ' '.repeat(Math.max(0, 30 - opt.name.length));
                usageText += `\n  --${opt.name}${padding}${opt.description}`;
            }
        }
    }

    usageText += `

例:
  pm-tool fetch 1234
  pm-tool fetch 1234 --stdout
  pm-tool fetch 1234 --json --dir ./output
  pm-tool update ticket-1234.md
  pm-tool update ticket-1234.md --dry-run`;

    // プラグイン固有の例を追加
    if (plugin) {
        if (plugin.name === 'redmine') {
            usageText += `
  pm-tool fetch https://redmine.example.com/issues/1234
  pm-tool update ticket-1234.md --comment "実装完了"`;
        } else if (plugin.name === 'backlog') {
            usageText += `
  pm-tool fetch PROJ-123
  pm-tool update task/PROJ-123.md --start-date 2025-11-01`;
        }
    }

    console.log(usageText.trim());
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
    // 文字列に変換（数値が渡された場合に備えて）
    const inputStr = String(input);

    // URL形式でない場合はそのまま返す
    if (!inputStr.startsWith('http://') && !inputStr.startsWith('https://')) {
        return inputStr;
    }

    try {
        const inputUrl = new URL(inputStr);
        const baseUrl = new URL(configUrl);

        // プロトコル、ホスト、ポートが一致するか確認
        if (inputUrl.protocol !== baseUrl.protocol ||
            inputUrl.hostname !== baseUrl.hostname ||
            inputUrl.port !== baseUrl.port) {
            throw new PmToolError(
                `URLが設定と一致しません\n設定: ${configUrl}\n入力: ${inputStr}`,
                'URL_MISMATCH',
                { configUrl, inputUrl: inputStr }
            );
        }

        // パスからチケット番号を抽出（Redmine形式: /issues/123 または /issues/123.json）
        const match = inputUrl.pathname.match(/\/issues\/(\d+)/);
        if (!match) {
            throw new PmToolError(
                `URLからチケット番号を抽出できませんでした: ${inputStr}`,
                'INVALID_URL_FORMAT',
                { url: inputStr }
            );
        }

        return match[1];
    } catch (error) {
        if (error instanceof PmToolError) {
            throw error;
        }
        throw new PmToolError(
            `不正なURL形式です: ${inputStr}`,
            'INVALID_URL',
            { url: inputStr, originalError: error.message }
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
        const filepath = path.resolve(outputDir, filename);
        fs.mkdirSync(path.dirname(filepath), { recursive: true });
        fs.writeFileSync(filepath, JSON.stringify(result, null, 2), 'utf8');
        info(`JSONファイルを保存しました: ${filepath}`);
        return result;
    }

    // Markdown形式で保存(デフォルト)
    const filename = `${prefix}${ticketId}.md`;
    const filepath = path.resolve(outputDir, filename);
    const markdown = formatMarkdown(result);
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, markdown, 'utf8');
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
    if (!fs.existsSync(filePath)) {
        throw new PmToolError(`ファイルが見つかりません: ${filePath}`, 'FILE_NOT_FOUND');
    }

    const { tool, config } = getPmToolConfig();

    // ファイルを読み込んでYAMLフロントマターをパース
    const fileContent = fs.readFileSync(filePath, 'utf8');
    // CRLF(\r\n)とLF(\n)の両方に対応
    const frontmatterMatch = fileContent.match(/^---\r?\n([\s\S]+?)\r?\n---\r?\n([\s\S]*)$/);

    if (!frontmatterMatch) {
        throw new PmToolError('YAMLフロントマターが見つかりません', 'INVALID_FORMAT');
    }

    const frontmatter = YAML.parse(frontmatterMatch[1]);
    // CRLFをLFに正規化（プラットフォーム間の互換性確保）
    const bodyContent = frontmatterMatch[2]
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .trim();

    // プラグインをロード
    const plugin = await loadPlugin(tool);

    // チケットIDを取得(プラグインに委譲)
    const ticketId = plugin.extractTicketId(frontmatter);
    if (!ticketId) {
        throw new PmToolError(
            `YAMLフロントマターからチケットIDを抽出できませんでした (${tool}プラグイン)`,
            'INVALID_FORMAT'
        );
    }

    info(`チケット ${ticketId} を更新します...`);

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
 * zx組み込みのminimist(argv)を使用
 *
 * @param {string[]} args - コマンドライン引数
 * @param {Object} plugin - プラグインオブジェクト（オプション、オプション定義の取得に使用）
 * @returns {Object} パースされた引数
 */
function parseArgs(args, plugin = null) {
    // プラグインから文字列型・数値型のオプションを動的に取得
    const stringOptions = ['dir', 'prefix']; // 共通オプション
    const booleanOptions = ['help', 'version', 'dry-run', 'stdout', 'json']; // 共通オプション

    if (plugin && typeof plugin.getUpdateOptions === 'function') {
        const updateOptions = plugin.getUpdateOptions();
        for (const opt of updateOptions) {
            if (opt.type === 'string') {
                stringOptions.push(opt.name);
            }
            // number型もminimistではstringとして扱い、プラグイン側で変換する
            else if (opt.type === 'number') {
                stringOptions.push(opt.name);
            }
        }
    }

    // minimistでパース（zxのargvを利用）
    const parsed = minimist(args, {
        string: stringOptions,
        boolean: booleanOptions,
        alias: {
            h: 'help',
            v: 'version'
        }
    });

    // 残りの引数（コマンドとチケットID/ファイルパス）
    const positional = parsed._;

    // ヘルプまたはバージョンが指定された場合
    if (parsed.help) {
        return { command: 'help', ticketId: null, options: {} };
    }
    if (parsed.version) {
        return { command: 'version', ticketId: null, options: {} };
    }

    // コマンドとチケットID/ファイルパスを抽出
    const command = positional[0] || null;
    const ticketId = positional[1] || null;

    // オプションを抽出（_, help, version以外）
    const { _, help, version, h, v, ...options } = parsed;

    return {
        command,
        ticketId,
        options
    };
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

        // 第1段階: 基本パース（コマンド判定のみ、プラグイン情報なし）
        const basicParsed = parseArgs(args);
        const { command, ticketId } = basicParsed;
        let { options } = basicParsed;

        // コマンドが指定されていない場合
        if (!command) {
            showUsage();
            process.exit(1);
        }

        // 第2段階: updateコマンドの場合はプラグインをロードして再パース
        if (command === 'update') {
            try {
                const { tool } = getPmToolConfig();
                const plugin = await loadPlugin(tool);
                // プラグイン情報を使って再パース
                const reparsed = parseArgs(args, plugin);
                options = reparsed.options;
            } catch (error) {
                // プラグインロード失敗時は基本パース結果を使用
                debug('プラグインロードに失敗したため、基本パース結果を使用します', error);
            }
        }

        // コマンド実行
        switch (command) {
            case 'help':
                // ヘルプ表示時にプラグイン情報を含める
                try {
                    const { tool } = getPmToolConfig();
                    const plugin = await loadPlugin(tool);
                    showUsage(plugin);
                } catch (error) {
                    // プラグインのロードに失敗した場合は基本ヘルプのみ表示
                    showUsage();
                }
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
