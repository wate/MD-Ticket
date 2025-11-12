#!/usr/bin/env zx

import { get, createBasicAuthHeader } from '../../common/api.js';
import { info, debug } from '../../common/logger.js';
import { ValidationError } from '../../common/error.js';

/**
 * Redmineチケット情報を取得する
 *
 * @param {Object} config - Redmine設定
 * @param {string} ticketId - チケットID
 * @param {Object} options - オプション
 * @returns {Promise<Object>} チケット情報
 */
export async function fetchTicket(config, ticketId, options = {}) {
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

    debug('Redmineチケット取得', { ticketId, url: config.url, authType: hasApiKey ? 'api_key' : 'basic' });

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
    const response = await get(url, headers);

    info(`チケット #${ticketId} の情報を取得しました`);

    // YAMLフロントマター形式に変換
    return formatAsYamlFrontmatter(response.issue);
}

/**
 * Redmineチケット情報をYAMLフロントマター形式に変換する
 *
 * @param {Object} issue - Redmineチケット情報
 * @returns {Object} フロントマター形式のデータ
 */
function formatAsYamlFrontmatter(issue) {
    const meta = {
        id: issue.id,
        project: issue.project ? {
            id: issue.project.id,
            name: issue.project.name
        } : undefined,
        tracker: issue.tracker ? {
            id: issue.tracker.id,
            name: issue.tracker.name
        } : undefined,
        status: issue.status ? {
            id: issue.status.id,
            name: issue.status.name
        } : undefined,
        priority: issue.priority ? {
            id: issue.priority.id,
            name: issue.priority.name
        } : undefined,
        author: issue.author ? {
            id: issue.author.id,
            name: issue.author.name
        } : undefined,
        assigned_to: issue.assigned_to ? {
            id: issue.assigned_to.id,
            name: issue.assigned_to.name
        } : undefined,
        category: issue.category ? {
            id: issue.category.id,
            name: issue.category.name
        } : undefined,
        estimated_hours: issue.estimated_hours,
        start_date: issue.start_date,
        due_date: issue.due_date,
        done_ratio: issue.done_ratio,
        created_on: issue.created_on,
        updated_on: issue.updated_on
    };

    // undefinedのフィールドを削除
    removeUndefinedFields(meta);

    const body = issue.description || '';
    const title = issue.subject || '';

    return {
        meta,
        body,
        title
    };
}

/**
 * オブジェクトからundefinedのフィールドを再帰的に削除する
 *
 * @param {Object} obj - 対象オブジェクト
 */
function removeUndefinedFields(obj) {
    Object.keys(obj).forEach(key => {
        if (obj[key] === undefined) {
            delete obj[key];
        } else if (obj[key] !== null && typeof obj[key] === 'object') {
            removeUndefinedFields(obj[key]);
        }
    });
}
