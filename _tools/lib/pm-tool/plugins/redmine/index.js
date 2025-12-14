#!/usr/bin/env zx

import { fetchTicket } from './issue/fetch.js';
import { updateTicket } from './issue/update.js';
import { debug } from '../../common/logger.js';

/**
 * Redmineプラグイン
 */
export default {
    name: 'redmine',
    label: 'Redmine',

    /**
     * デフォルト設定
     */
    defaults: {
        file_prefix: 'ticket-'
    },

    /**
     * チケット情報を取得する
     *
     * @param {Object} config - Redmine設定
     * @param {string} ticketId - チケットID
     * @param {Object} options - オプション
     * @returns {Promise<Object>} チケット情報
     */
    async issueFetch(config, ticketId, options = {}) {
        debug('Redmineプラグイン: issueFetch', { ticketId });
        return await fetchTicket(config, ticketId, options);
    },

    /**
     * チケット情報を更新する
     *
     * @param {Object} config - Redmine設定
     * @param {string} ticketId - チケットID
     * @param {Object} updateData - 更新データ
     * @returns {Promise<Object>} 更新結果
     */
    async issueUpdate(config, ticketId, updateData = {}) {
        debug('Redmineプラグイン: issueUpdate', { ticketId });
        return await updateTicket(config, ticketId, updateData);
    },

    /**
     * YAMLフロントマターからチケットIDを抽出する
     *
     * @param {Object} frontmatter - YAMLフロントマター
     * @returns {string|null} チケットID
     */
    extractTicketId(frontmatter) {
        return frontmatter.id || null;
    },

    /**
     * URLからチケットIDを抽出する
     *
     * @param {string} url - Redmine URL
     * @returns {string|null} チケットID、抽出できない場合はnull
     */
    parseUrl(url) {
        try {
            const urlObj = new URL(url);
            // Redmine形式: /issues/123 または /issues/123.json
            const match = urlObj.pathname.match(/\/issues\/(\d+)/);
            return match ? match[1] : null;
        } catch (error) {
            return null;
        }
    },

    /**
     * 更新時に使用可能なオプションを返す
     *
     * @returns {Array<Object>} オプション一覧
     */
    getIssueUpdateOptions() {
        // 現時点ではissue/updateのみ対応。
        return [
            { name: 'comment', description: 'コメント', type: 'string' },
            { name: 'status', description: 'ステータスID', type: 'number' },
            { name: 'assigned-to', description: '担当者ID', type: 'number' },
            { name: 'done-ratio', description: '進捗率(0-100)', type: 'number' },
            { name: 'estimated-hours', description: '予定工数', type: 'number' },
            { name: 'start-date', description: '開始日(YYYY-MM-DD)', type: 'string' },
            { name: 'due-date', description: '期日(YYYY-MM-DD)', type: 'string' },
            { name: 'priority', description: '優先度ID', type: 'number' },
            { name: 'category', description: 'カテゴリID', type: 'number' },
        ];
    },

    /**
     * 設定を検証する
     *
     * @param {Object} config - Redmine設定
     * @returns {Promise<Object>} 検証結果
     */
    async validate(config) {
        debug('Redmineプラグイン: validate');

        const errors = [];

        if (!config.url) {
            errors.push('Redmine URLが設定されていません (integration.pm_tool.redmine.url)');
        }

        // 認証情報の検証（APIキーまたはBasic認証のいずれかが必要）
        const hasApiKey = !!config.api_key;
        const hasBasicAuth = !!(config.username && config.password);

        if (!hasApiKey && !hasBasicAuth) {
            errors.push(
                'Redmine認証情報が設定されていません。' +
                'api_key または username/password のいずれかを設定してください'
            );
        }

        // Basic認証の場合、username/passwordの両方が必要
        if (!hasApiKey && (config.username && !config.password)) {
            errors.push('usernameが設定されていますが、passwordが設定されていません');
        }
        if (!hasApiKey && (!config.username && config.password)) {
            errors.push('passwordが設定されていますが、usernameが設定されていません');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
};
