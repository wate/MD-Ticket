#!/usr/bin/env zx

import { info, debug, warn } from '../../../common/logger.js';
import { ValidationError, ApiError, AuthenticationError, NetworkError } from '../../../common/error.js';
import { retry } from '../../../common/retry.js';

/**
 * Backlog課題情報を取得する
 *
 * @param {Object} config - Backlog設定
 * @param {string} issueKey - 課題キー(例: PROJ-123)
 * @param {Object} options - オプション
 * @returns {Promise<Object>} 課題情報({meta, title, body}形式)
 */
export async function fetchIssue(config, issueKey, options = {}) {
    // 設定の検証
    if (!config.url) {
        throw new ValidationError('Backlog URLが設定されていません (integration.pm_tool.backlog.url)');
    }

    if (!config.api_key) {
        throw new ValidationError('Backlog APIキーが設定されていません (integration.pm_tool.backlog.api_key)');
    }

    debug('Backlog課題取得', { issueKey, url: config.url });

    info(`Backlog課題を取得: ${issueKey}`);

    // API呼び出し
    const issue = await retry(
        () => callBacklogApi(config, issueKey),
        {
            maxRetries: 3,
            shouldRetry: (error) => {
                // 認証エラーと404はリトライしない
                return !(error instanceof AuthenticationError) &&
                    !(error instanceof ApiError && error.statusCode === 404);
            }
        }
    );

    info('課題情報を取得しました', { key: issue.issueKey, summary: issue.summary });

    // YAMLフロントマター形式に変換
    return formatAsYamlFrontmatter(issue);
}

/**
 * Backlog APIを呼び出す
 *
 * @param {Object} config - Backlog設定
 * @param {string} issueKey - 課題キー
 * @returns {Promise<Object>} 課題情報
 */
async function callBacklogApi(config, issueKey) {
    const baseUrl = config.url.replace(/\/$/, '');
    const url = new URL(`${baseUrl}/api/v2/issues/${issueKey}`);
    url.searchParams.append('apiKey', config.api_key);

    debug('API リクエスト開始', { url: url.toString() });

    try {
        const response = await fetch(url.toString(), {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        debug('API レスポンス受信', { status: response.status, statusText: response.statusText });

        if (!response.ok) {
            const errorBody = await response.text();
            let errorMessage = `Backlog API エラー: ${response.status} ${response.statusText}`;

            try {
                const errorData = JSON.parse(errorBody);
                if (errorData.errors && errorData.errors.length > 0) {
                    errorMessage = errorData.errors.map(e => e.message).join(', ');
                }
            } catch {
                // JSONパースエラーは無視
            }

            if (response.status === 401) {
                throw new AuthenticationError('認証に失敗しました。APIキーを確認してください。', {
                    status: response.status,
                    body: errorBody
                });
            }

            if (response.status === 404) {
                throw new ApiError('指定された課題が見つかりません。', response.status, {
                    body: errorBody
                });
            }

            throw new ApiError(errorMessage, response.status, { body: errorBody });
        }

        return await response.json();
    } catch (error) {
        if (error instanceof ValidationError || error instanceof AuthenticationError || error instanceof ApiError) {
            throw error;
        }

        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new NetworkError('ネットワークエラーが発生しました', {
                originalError: error.message
            });
        }

        throw error;
    }
}

/**
 * Backlog課題情報をYAMLフロントマター形式に変換する
 *
 * @param {Object} issue - Backlog課題情報
 * @returns {Object} フロントマター形式のデータ({meta, title, body})
 */
function formatAsYamlFrontmatter(issue) {
    const meta = {
        backlog_id: issue.id,
        backlog_key: issue.issueKey,
        project_id: issue.projectId,
        title: issue.summary,
        type: issue.issueType?.name || '',
        status: issue.status?.name || '',
        priority: issue.priority?.name || '',
        assignee: issue.assignee?.name || '',
        created_at: issue.created,
        updated_at: issue.updated
    };

    // 任意フィールド(値がある場合のみ追加)
    if (issue.startDate) {
        meta.start_date = issue.startDate;
    }
    if (issue.dueDate) {
        meta.due_date = issue.dueDate;
    }
    if (issue.estimatedHours !== null && issue.estimatedHours !== undefined) {
        meta.estimated_hours = issue.estimatedHours;
    }
    if (issue.actualHours !== null && issue.actualHours !== undefined) {
        meta.actual_hours = issue.actualHours;
    }

    // 本文のCRLFをLFに正規化（プラットフォーム非依存にする）
    const body = issue.description ? issue.description.replace(/\r\n/g, '\n').replace(/\r/g, '\n') : '';
    const title = issue.summary || 'Untitled';

    return {
        meta,
        title,
        body
    };
}
