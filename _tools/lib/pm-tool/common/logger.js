#!/usr/bin/env zx

/**
 * ログレベル定義
 */
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

/**
 * 現在のログレベル（環境変数PM_TOOL_LOG_LEVELで設定可能）
 */
const currentLogLevel = LOG_LEVELS[process.env.PM_TOOL_LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;

/**
 * タイムスタンプを生成する
 *
 * @returns {string} ISO形式のタイムスタンプ
 */
function timestamp() {
    return new Date().toISOString();
}

/**
 * ログメッセージをフォーマットする
 *
 * @param {string} level - ログレベル
 * @param {string} message - ログメッセージ
 * @param {Object} [data] - 追加データ
 * @returns {string} フォーマットされたログメッセージ
 */
function formatMessage(level, message, data) {
    let formatted = `[${timestamp()}] [${level}] ${message}`;
    if (data) {
        formatted += ` ${JSON.stringify(data)}`;
    }
    return formatted;
}

/**
 * DEBUGレベルのログを出力する
 *
 * @param {string} message - ログメッセージ
 * @param {Object} [data] - 追加データ
 */
export function debug(message, data) {
    if (currentLogLevel <= LOG_LEVELS.DEBUG) {
        console.debug(formatMessage('DEBUG', message, data));
    }
}

/**
 * INFOレベルのログを出力する
 *
 * @param {string} message - ログメッセージ
 * @param {Object} [data] - 追加データ
 */
export function info(message, data) {
    if (currentLogLevel <= LOG_LEVELS.INFO) {
        console.info(formatMessage('INFO', message, data));
    }
}

/**
 * WARNレベルのログを出力する
 *
 * @param {string} message - ログメッセージ
 * @param {Object} [data] - 追加データ
 */
export function warn(message, data) {
    if (currentLogLevel <= LOG_LEVELS.WARN) {
        console.warn(formatMessage('WARN', message, data));
    }
}

/**
 * ERRORレベルのログを出力する
 *
 * @param {string} message - ログメッセージ
 * @param {Error|Object} [error] - エラーオブジェクトまたは追加データ
 */
export function error(message, error) {
    if (currentLogLevel <= LOG_LEVELS.ERROR) {
        const data = error instanceof Error
            ? { message: error.message, stack: error.stack }
            : error;
        console.error(formatMessage('ERROR', message, data));
    }
}
