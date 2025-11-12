#!/usr/bin/env zx

import { put, createBasicAuthHeader } from '../../common/api.js';
import { info, debug } from '../../common/logger.js';
import { ValidationError, ApiError } from '../../common/error.js';

/**
 * Redmineチケット情報を更新する
 *
 * @param {Object} config - Redmine設定
 * @param {string} ticketId - チケットID
 * @param {Object} updateData - 更新データ
 * @returns {Promise<Object>} 更新結果
 */
export async function updateTicket(config, ticketId, updateData = {}) {
    // 設定の検証
    if (!config.url) {
        throw new ValidationError('Redmine URLが設定されていません (integration.pm_tool.redmine.url)');
    }

    // 認証情報の検証（APIキーまたはBasic認証）
    const hasApiKey = !!config.api_key;
    const hasBasicAuth = !!(config.username && config.password);

    if (!hasApiKey && !hasBasicAuth) {
        throw new ValidationError(
            'Redmine認証情報が設定されていません。' +
            'api_key または username/password のいずれかを設定してください'
        );
    }

    debug('Redmineチケット更新', { ticketId, updateData, authType: hasApiKey ? 'api_key' : 'basic' });

    // 更新データを構築
    const issueData = buildIssueUpdateData(updateData);

    if (Object.keys(issueData).length === 0) {
        throw new ValidationError('更新する内容が指定されていません');
    }

    // Redmine APIエンドポイント
    const url = `${config.url}/issues/${ticketId}.json`;

    // 更新ペイロードを表示
    console.log('\n=== Redmine API更新ペイロード ===');
    console.log('URL:', url);
    console.log('Payload:', JSON.stringify({ issue: issueData }, null, 2));
    console.log('================================\n');

    // dry-runモードの場合はAPI呼び出しをスキップ
    if (updateData.dryRun || updateData['dry-run']) {
        info('[DRY RUN] 実際の更新は行いません');
        return {
            success: true,
            message: `[DRY RUN] チケット #${ticketId} の更新をシミュレートしました`,
            updated: issueData,
            dryRun: true
        };
    }

    // 認証ヘッダーの準備
    const headers = {};
    if (hasApiKey) {
        headers['X-Redmine-API-Key'] = config.api_key;
    } else {
        // Basic認証の場合
        headers['Authorization'] = createBasicAuthHeader(config.username, config.password);
    }

    // API呼び出し
    try {
        const response = await put(url, { issue: issueData }, headers);

        info(`チケット #${ticketId} を更新しました`);

        return {
            success: true,
            message: `チケット #${ticketId} を更新しました`,
            updated: issueData
        };
    } catch (error) {
        // 404エラーの場合、より分かりやすいメッセージに変換
        if (error instanceof ApiError && error.statusCode === 404) {
            throw new ApiError(
                `チケット #${ticketId} が見つかりません (404 Not Found)`,
                404,
                { ticketId, url }
            );
        }
        // その他のエラーはそのまま再スロー
        throw error;
    }
}

/**
 * 更新データをRedmine API形式に変換する
 * YAMLフロントマターとコマンドラインオプションから更新データを抽出
 *
 * @param {Object} updateData - 更新データ（frontmatter, body, コマンドラインオプション）
 * @returns {Object} Redmine API形式の更新データ
 */
function buildIssueUpdateData(updateData) {
    const issueData = {};
    const frontmatter = updateData.frontmatter || {};
    const body = updateData.body || '';

    // コメント（notes）- コマンドラインオプションのみ
    if (updateData.comment) {
        issueData.notes = updateData.comment;
    }

    // 説明（description）- コマンドラインオプション優先、なければYAMLから抽出
    if (updateData.description) {
        issueData.description = updateData.description;
    } else if (body) {
        // h1見出しを除いた本文を説明として使用
        // setext記法（タイトル\n===）またはatx記法（# タイトル）に対応
        let description = body;

        // setext記法のh1を除去
        const setextMatch = body.match(/^[^\n]+\n=+\n+(.+)$/s);
        if (setextMatch) {
            description = setextMatch[1].trim();
        } else {
            // atx記法のh1を除去
            const atxMatch = body.match(/^#\s+[^\n]+\n+(.+)$/s);
            if (atxMatch) {
                description = atxMatch[1].trim();
            }
        }

        if (description && description !== body) {
            issueData.description = description;
        }
    }

    // ステータスID - コマンドラインオプション優先、なければYAMLから
    if (updateData.status) {
        issueData.status_id = parseInt(updateData.status, 10);
    } else if (frontmatter.status?.id) {
        issueData.status_id = frontmatter.status.id;
    }

    // 担当者ID - コマンドラインオプション優先、なければYAMLから
    if (updateData.assigned_to) {
        issueData.assigned_to_id = parseInt(updateData.assigned_to, 10);
    } else if (frontmatter.assigned_to?.id) {
        issueData.assigned_to_id = frontmatter.assigned_to.id;
    }

    // 進捗率 - コマンドラインオプション優先、なければYAMLから
    if (updateData.done_ratio !== undefined) {
        issueData.done_ratio = parseInt(updateData.done_ratio, 10);
    } else if (frontmatter.done_ratio !== undefined) {
        issueData.done_ratio = frontmatter.done_ratio;
    }

    // 予定工数 - コマンドラインオプション優先、なければYAMLから
    if (updateData.estimated_hours !== undefined) {
        issueData.estimated_hours = parseFloat(updateData.estimated_hours);
    } else if (frontmatter.estimated_hours !== null && frontmatter.estimated_hours !== undefined) {
        issueData.estimated_hours = frontmatter.estimated_hours;
    }

    // 開始日 - コマンドラインオプション優先、なければYAMLから
    if (updateData.start_date) {
        issueData.start_date = updateData.start_date;
    } else if (frontmatter.start_date) {
        issueData.start_date = frontmatter.start_date;
    }

    // 期日 - コマンドラインオプション優先、なければYAMLから
    if (updateData.due_date) {
        issueData.due_date = updateData.due_date;
    } else if (frontmatter.due_date) {
        issueData.due_date = frontmatter.due_date;
    }

    // 優先度ID - コマンドラインオプションのみ（YAMLフロントマターには通常含まれない）
    if (updateData.priority) {
        issueData.priority_id = parseInt(updateData.priority, 10);
    }

    // カテゴリID - コマンドラインオプションのみ（YAMLフロントマターには通常含まれない）
    if (updateData.category) {
        issueData.category_id = parseInt(updateData.category, 10);
    }

    return issueData;
}
