#!/usr/bin/env zx

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 環境変数を展開する
 * ${VARIABLE_NAME}形式の文字列をprocess.env.VARIABLE_NAMEに置き換える
 *
 * @param {string} str - 展開対象の文字列
 * @returns {string} 環境変数が展開された文字列
 */
function expandEnvVars(str) {
    if (typeof str !== 'string') {
        return str;
    }

    return str.replace(/\$\{([^}]+)\}/g, (match, varName) => {
        return process.env[varName] || match;
    });
}

/**
 * オブジェクト内のすべての環境変数を再帰的に展開する
 *
 * @param {*} obj - 展開対象のオブジェクト
 * @returns {*} 環境変数が展開されたオブジェクト
 */
function expandEnvVarsRecursive(obj) {
    if (typeof obj === 'string') {
        return expandEnvVars(obj);
    }

    if (Array.isArray(obj)) {
        return obj.map(item => expandEnvVarsRecursive(item));
    }

    if (obj !== null && typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = expandEnvVarsRecursive(value);
        }
        return result;
    }

    return obj;
}

/**
 * config.ymlを読み込み、パースする
 *
 * @returns {Object} パースされた設定オブジェクト
 * @throws {Error} 設定ファイルが見つからない、またはパースできない場合
 */
export function loadConfig() {
    // 実行ファイル(pm-tool)のディレクトリから見た.ticket/config.ymlへのパス
    // pm-toolは.ticket/_tools/にあるため、../config.ymlで.ticket/config.ymlを指す
    const configPath = resolve(__dirname, '../config.yml');

    try {
        const configContent = readFileSync(configPath, 'utf8');
        const config = YAML.parse(configContent);

        // 環境変数を展開
        return expandEnvVarsRecursive(config);
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(`設定ファイルが見つかりません: ${configPath}`);
        }
        throw new Error(`設定ファイルの読み込みに失敗しました: ${error.message}`);
    }
}

/**
 * PM Tool設定を取得する
 *
 * @returns {Object} PM Tool設定オブジェクト
 * @throws {Error} PM Tool設定が無効な場合
 */
export function getPmToolConfig() {
    const config = loadConfig();

    if (!config.integration?.pm_tool) {
        throw new Error('config.ymlにintegration.pm_tool設定が見つかりません');
    }

    const pmToolConfig = config.integration.pm_tool;

    if (!pmToolConfig.type) {
        throw new Error('連携ツールが設定されていません (integration.pm_tool.type)');
    }

    const toolName = pmToolConfig.type;
    const toolConfig = pmToolConfig[toolName];

    if (!toolConfig) {
        throw new Error(`ツール "${toolName}" の設定が見つかりません`);
    }

    return {
        tool: toolName,
        config: toolConfig
    };
}
