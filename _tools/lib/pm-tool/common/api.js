#!/usr/bin/env zx

import { debug, error as logError } from './logger.js';
import { ApiError, NetworkError, AuthenticationError, normalizeError } from './error.js';
import { retry, isTransientError } from './retry.js';

/**
 * Basic認証ヘッダーを生成する
 *
 * @param {string} username - ユーザー名
 * @param {string} password - パスワード
 * @returns {string} Basic認証ヘッダー値
 */
export function createBasicAuthHeader(username, password) {
    const credentials = `${username}:${password}`;
    const encoded = Buffer.from(credentials).toString('base64');
    return `Basic ${encoded}`;
}

/**
 * HTTP APIリクエストを実行する
 *
 * @param {string} url - リクエストURL
 * @param {Object} options - fetchオプション
 * @param {Object} [retryOptions] - リトライオプション
 * @returns {Promise<Object>} レスポンスオブジェクト
 * @throws {ApiError|NetworkError|AuthenticationError} API呼び出しエラー
 */
export async function apiRequest(url, options = {}, retryOptions = {}) {
    debug(`API Request: ${options.method || 'GET'} ${url}`);

    // デフォルトのリトライ設定
    const defaultRetryOptions = {
        maxRetries: 3,
        shouldRetry: (error) => isTransientError(error)
    };

    const finalRetryOptions = { ...defaultRetryOptions, ...retryOptions };

    try {
        return await retry(async () => {
            try {
                const response = await fetch(url, {
                    timeout: 30000, // 30秒タイムアウト
                    ...options
                });

                debug(`API Response: ${response.status} ${response.statusText}`);

                // 認証エラー
                if (response.status === 401) {
                    throw new AuthenticationError('認証に失敗しました。APIキーまたはトークンを確認してください', {
                        url,
                        status: response.status
                    });
                }

                // 権限エラー
                if (response.status === 403) {
                    throw new AuthenticationError('アクセス権限がありません', {
                        url,
                        status: response.status
                    });
                }

                // レート制限
                if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After');
                    throw new ApiError(
                        'レート制限に達しました。しばらく待ってから再試行してください',
                        response.status,
                        { retryAfter }
                    );
                }

                // サーバーエラー
                if (response.status >= 500) {
                    const text = await response.text();
                    throw new ApiError(
                        'サーバーエラーが発生しました',
                        response.status,
                        { responseBody: text }
                    );
                }

                // クライアントエラー
                if (!response.ok) {
                    const text = await response.text();
                    throw new ApiError(
                        `APIエラー: ${response.statusText}`,
                        response.status,
                        { responseBody: text }
                    );
                }

                // JSONレスポンスをパース
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    return await response.json();
                }

                return await response.text();
            } catch (error) {
                // fetch自体のエラー（ネットワークエラー等）
                if (error instanceof TypeError) {
                    throw new NetworkError('ネットワークエラーが発生しました', {
                        url,
                        originalError: error.message
                    });
                }
                throw error;
            }
        }, finalRetryOptions);
    } catch (error) {
        logError(`API Request Failed: ${url}`, error);
        throw normalizeError(error);
    }
}

/**
 * GETリクエストを実行する
 *
 * @param {string} url - リクエストURL
 * @param {Object} [headers] - リクエストヘッダー
 * @param {Object} [retryOptions] - リトライオプション
 * @returns {Promise<Object>} レスポンスオブジェクト
 */
export async function get(url, headers = {}, retryOptions = {}) {
    return apiRequest(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...headers
        }
    }, retryOptions);
}

/**
 * POSTリクエストを実行する
 *
 * @param {string} url - リクエストURL
 * @param {Object} body - リクエストボディ
 * @param {Object} [headers] - リクエストヘッダー
 * @param {Object} [retryOptions] - リトライオプション
 * @returns {Promise<Object>} レスポンスオブジェクト
 */
export async function post(url, body, headers = {}, retryOptions = {}) {
    return apiRequest(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...headers
        },
        body: JSON.stringify(body)
    }, retryOptions);
}

/**
 * PUTリクエストを実行する
 *
 * @param {string} url - リクエストURL
 * @param {Object} body - リクエストボディ
 * @param {Object} [headers] - リクエストヘッダー
 * @param {Object} [retryOptions] - リトライオプション
 * @returns {Promise<Object>} レスポンスオブジェクト
 */
export async function put(url, body, headers = {}, retryOptions = {}) {
    return apiRequest(url, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...headers
        },
        body: JSON.stringify(body)
    }, retryOptions);
}

/**
 * DELETEリクエストを実行する
 *
 * @param {string} url - リクエストURL
 * @param {Object} [headers] - リクエストヘッダー
 * @param {Object} [retryOptions] - リトライオプション
 * @returns {Promise<Object>} レスポンスオブジェクト
 */
export async function del(url, headers = {}, retryOptions = {}) {
    return apiRequest(url, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            ...headers
        }
    }, retryOptions);
}
