#!/usr/bin/env zx

import { put, createBasicAuthHeader } from '../../common/api.js';
import { info, debug } from '../../common/logger.js';
import { ValidationError } from '../../common/error.js';

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

    // 認証ヘッダーの準備
    const headers = {};
    if (hasApiKey) {
        headers['X-Redmine-API-Key'] = config.api_key;
    } else {
        // Basic認証の場合
        headers['Authorization'] = createBasicAuthHeader(config.username, config.password);
    }

    // API呼び出し
    const response = await put(url, { issue: issueData }, headers);

    info(`チケット #${ticketId} を更新しました`);

    return {
        success: true,
        message: `チケット #${ticketId} を更新しました`,
        updated: issueData
    };
}

/**
 * 更新データをRedmine API形式に変換する
 *
 * @param {Object} updateData - 更新データ
 * @returns {Object} Redmine API形式の更新データ
 */
function buildIssueUpdateData(updateData) {
    const issueData = {};

    // コメント（notes）
    if (updateData.comment) {
        issueData.notes = updateData.comment;
    }

    // ステータスID
    if (updateData.status) {
        issueData.status_id = parseInt(updateData.status, 10);
    }

    // 担当者ID
    if (updateData.assigned_to) {
        issueData.assigned_to_id = parseInt(updateData.assigned_to, 10);
    }

    // 進捗率
    if (updateData.done_ratio !== undefined) {
        issueData.done_ratio = parseInt(updateData.done_ratio, 10);
    }

    // 予定工数
    if (updateData.estimated_hours !== undefined) {
        issueData.estimated_hours = parseFloat(updateData.estimated_hours);
    }

    // 開始日
    if (updateData.start_date) {
        issueData.start_date = updateData.start_date;
    }

    // 期日
    if (updateData.due_date) {
        issueData.due_date = updateData.due_date;
    }

    // 優先度ID
    if (updateData.priority) {
        issueData.priority_id = parseInt(updateData.priority, 10);
    }

    // カテゴリID
    if (updateData.category) {
        issueData.category_id = parseInt(updateData.category, 10);
    }

    return issueData;
}
