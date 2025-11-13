#!/usr/bin/env zx

import { info, debug, warn } from '../../common/logger.js';
import { ValidationError, ApiError, AuthenticationError, NetworkError } from '../../common/error.js';
import { retry } from '../../common/retry.js';

/**
 * Backlog課題情報を更新する
 *
 * @param {Object} config - Backlog設定
 * @param {string} issueKey - 課題キー
 * @param {Object} updateData - 更新データ(frontmatter, body, コマンドラインオプション)
 * @returns {Promise<Object>} 更新結果
 */
export async function updateIssue(config, issueKey, updateData = {}) {
    // 設定の検証
    if (!config.url) {
        throw new ValidationError('Backlog URLが設定されていません (integration.pm_tool.backlog.url)');
    }

    if (!config.api_key) {
        throw new ValidationError('Backlog APIキーが設定されていません (integration.pm_tool.backlog.api_key)');
    }

    info(`Backlog課題を更新: ${issueKey}`);

    // 元の課題情報を取得
    const originalIssue = await retry(
        () => callBacklogGetApi(config, issueKey),
        {
            maxRetries: 3,
            shouldRetry: (error) => {
                return !(error instanceof AuthenticationError) &&
                    !(error instanceof ApiError && error.statusCode === 404);
            }
        }
    );

    // 更新データを生成
    const updatePayload = buildUpdatePayload(updateData, originalIssue);

    // 更新内容がない場合は終了
    if (Object.keys(updatePayload).length === 0) {
        info('更新する項目がありません');
        return { success: true, message: '更新する項目がありません' };
    }

    // 課題を更新
    const updatedIssue = await retry(
        () => callBacklogUpdateApi(config, issueKey, updatePayload),
        {
            maxRetries: 2,
            shouldRetry: (error) => {
                return !(error instanceof AuthenticationError) &&
                    !(error instanceof ApiError && error.statusCode === 404) &&
                    !(error instanceof ApiError && error.statusCode === 400);
            }
        }
    );

    info('課題を更新しました', {
        key: updatedIssue.issueKey,
        updated: Object.keys(updatePayload)
    });

    return { success: true, issue: updatedIssue };
}

/**
 * Backlog課題取得APIを呼び出す
 *
 * @param {Object} config - Backlog設定
 * @param {string} issueKey - 課題キー
 * @returns {Promise<Object>} 課題情報
 */
async function callBacklogGetApi(config, issueKey) {
    const baseUrl = config.url.replace(/\/$/, '');
    const url = new URL(`${baseUrl}/api/v2/issues/${issueKey}`);
    url.searchParams.append('apiKey', config.api_key);

    debug('API リクエスト開始 (GET)', { url: url.toString() });

    const response = await fetch(url.toString(), {
        headers: {
            'Content-Type': 'application/json'
        }
    });

    return await handleApiResponse(response);
}

/**
 * Backlog課題更新APIを呼び出す
 *
 * @param {Object} config - Backlog設定
 * @param {string} issueKey - 課題キー
 * @param {Object} updatePayload - 更新データ
 * @returns {Promise<Object>} 更新後の課題情報
 */
async function callBacklogUpdateApi(config, issueKey, updatePayload) {
    const baseUrl = config.url.replace(/\/$/, '');
    const url = new URL(`${baseUrl}/api/v2/issues/${issueKey}`);
    url.searchParams.append('apiKey', config.api_key);

    // PATCH用のフォームデータを構築
    const formData = new URLSearchParams();
    for (const [key, value] of Object.entries(updatePayload)) {
        if (value !== null && value !== undefined) {
            formData.append(key, value);
        }
    }

    debug('API リクエスト開始 (PATCH)', { url: url.toString(), payload: updatePayload });

    const response = await fetch(url.toString(), {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
    });

    return await handleApiResponse(response);
}

/**
 * APIレスポンスを処理する
 *
 * @param {Response} response - fetchレスポンス
 * @returns {Promise<Object>} パースされたJSONデータ
 */
async function handleApiResponse(response) {
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
}

/**
 * YAMLフロントマターをBacklog課題更新データに変換する
 *
 * @param {Object} updateData - 更新データ(frontmatter, body, コマンドラインオプション)
 * @param {Object} originalIssue - 元の課題情報
 * @returns {Object} Backlog API用更新データ
 */
function buildUpdatePayload(updateData, originalIssue) {
    const frontmatter = updateData.frontmatter || {};
    const body = updateData.body || '';
    const payload = {};

    // 件名 - Markdown本文のh1見出しから自動抽出
    if (body) {
        const subject = extractSubjectFromMarkdown(body);
        if (subject && subject !== originalIssue.summary) {
            payload.summary = subject;
        }
    }

    // 説明 - Markdown本文から自動抽出（h1見出しを除く）
    if (body) {
        const description = extractDescriptionFromMarkdown(body);
        if (description && description !== originalIssue.description) {
            payload.description = description;
        }
    }

    // ステータス(名前からIDを取得する必要があるため未サポート)
    if (frontmatter.status && frontmatter.status !== originalIssue.status?.name) {
        warn('ステータスの更新はサポートされていません。Backlog側で手動更新してください。', {
            current: originalIssue.status?.name,
            requested: frontmatter.status
        });
    }

    // 期限日
    if (frontmatter.due_date !== undefined) {
        payload.dueDate = frontmatter.due_date || null;
    }

    // 開始日
    if (frontmatter.start_date !== undefined) {
        payload.startDate = frontmatter.start_date || null;
    }

    // 予定時間
    if (frontmatter.estimated_hours !== undefined) {
        payload.estimatedHours = frontmatter.estimated_hours;
    }

    // 実績時間
    if (frontmatter.actual_hours !== undefined) {
        payload.actualHours = frontmatter.actual_hours;
    }

    return payload;
}

/**
 * Markdown本文からsubject（件名）を抽出する
 * h1見出しを取得して返す
 *
 * @param {string} body - Markdown本文（LF改行）
 * @returns {string} 件名（h1見出しのテキスト）
 */
function extractSubjectFromMarkdown(body) {
    if (!body) {
        return '';
    }

    // setext記法のh1（タイトル\n===）を抽出
    const setextMatch = body.match(/^([^\n]+)\n=+/);
    if (setextMatch) {
        return setextMatch[1].trim();
    }

    // atx記法のh1（# タイトル）を抽出
    const atxMatch = body.match(/^#\s+(.+)$/m);
    if (atxMatch) {
        return atxMatch[1].trim();
    }

    // h1が見つからない場合は空文字列を返す
    return '';
}

/**
 * Markdown本文からdescription（説明）を抽出する
 * h1見出しを除去し、残りの本文を返す
 *
 * @param {string} body - Markdown本文（LF改行）
 * @returns {string} 説明（h1見出しを除いた本文）
 */
function extractDescriptionFromMarkdown(body) {
    if (!body) {
        return '';
    }

    // setext記法のh1（タイトル\n===）を除去
    const setextMatch = body.match(/^[^\n]+\n=+\n+(.+)$/s);
    if (setextMatch) {
        return setextMatch[1].trim();
    }

    // atx記法のh1（# タイトル）を除去
    const atxMatch = body.match(/^#\s+[^\n]+\n+(.+)$/s);
    if (atxMatch) {
        return atxMatch[1].trim();
    }

    // h1が見つからない場合は本文全体を返す
    return body.trim();
}
