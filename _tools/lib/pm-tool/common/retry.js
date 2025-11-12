#!/usr/bin/env zx

import { warn, debug } from './logger.js';

/**
 * 指定ミリ秒待機する
 *
 * @param {number} ms - 待機時間（ミリ秒）
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 指数バックオフでリトライを実行する
 *
 * @param {Function} fn - 実行する関数
 * @param {Object} options - オプション
 * @param {number} [options.maxRetries=3] - 最大リトライ回数
 * @param {number} [options.initialDelay=1000] - 初回待機時間（ミリ秒）
 * @param {number} [options.maxDelay=10000] - 最大待機時間（ミリ秒）
 * @param {number} [options.backoffMultiplier=2] - バックオフ倍率
 * @param {Function} [options.shouldRetry] - リトライすべきかを判定する関数
 * @returns {Promise<*>} 関数の実行結果
 * @throws {Error} すべてのリトライが失敗した場合
 */
export async function retry(fn, options = {}) {
    const {
        maxRetries = 3,
        initialDelay = 1000,
        maxDelay = 10000,
        backoffMultiplier = 2,
        shouldRetry = () => true
    } = options;

    let lastError;
    let delay = initialDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            debug(`実行試行 ${attempt + 1}/${maxRetries + 1}`);
            return await fn();
        } catch (error) {
            lastError = error;

            // 最後の試行の場合はリトライしない
            if (attempt === maxRetries) {
                break;
            }

            // リトライすべきでない場合は即座に失敗
            if (!shouldRetry(error)) {
                debug('リトライすべきでないエラーのため中断', { error: error.message });
                throw error;
            }

            warn(`実行失敗 (${attempt + 1}/${maxRetries + 1}): ${error.message}`, {
                nextRetryIn: delay
            });

            await sleep(delay);

            // 次のディレイを計算（指数バックオフ）
            delay = Math.min(delay * backoffMultiplier, maxDelay);
        }
    }

    // すべてのリトライが失敗
    throw lastError;
}

/**
 * レート制限エラーかどうかを判定する
 *
 * @param {Error} error - エラーオブジェクト
 * @returns {boolean} レート制限エラーの場合true
 */
export function isRateLimitError(error) {
    return error.statusCode === 429;
}

/**
 * 一時的なエラーかどうかを判定する
 *
 * @param {Error} error - エラーオブジェクト
 * @returns {boolean} 一時的なエラーの場合true
 */
export function isTransientError(error) {
    // レート制限
    if (isRateLimitError(error)) {
        return true;
    }

    // 5xx系エラー
    if (error.statusCode >= 500 && error.statusCode < 600) {
        return true;
    }

    // ネットワークエラー
    if (error.name === 'NetworkError') {
        return true;
    }

    // タイムアウトエラー
    if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
        return true;
    }

    return false;
}
