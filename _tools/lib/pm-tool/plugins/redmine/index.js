#!/usr/bin/env zx

import { fetchTicket } from './fetch.js';
import { updateTicket } from './update.js';
import { debug } from '../../common/logger.js';

/**
 * Redmineプラグイン
 */
export default {
    name: 'redmine',
    label: 'Redmine',

    /**
     * チケット情報を取得する
     *
     * @param {Object} config - Redmine設定
     * @param {string} ticketId - チケットID
     * @param {Object} options - オプション
     * @returns {Promise<Object>} チケット情報
     */
    async fetch(config, ticketId, options = {}) {
        debug('Redmineプラグイン: fetch', { ticketId });
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
    async update(config, ticketId, updateData = {}) {
        debug('Redmineプラグイン: update', { ticketId });
        return await updateTicket(config, ticketId, updateData);
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
