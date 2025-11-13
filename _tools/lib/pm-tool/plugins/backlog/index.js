#!/usr/bin/env zx

import { fetchIssue } from './fetch.js';
import { updateIssue } from './update.js';
import { debug } from '../../common/logger.js';

/**
 * Backlogプラグイン
 */
export default {
    name: 'backlog',
    label: 'Backlog',
    defaults: {
        file_prefix: '' // Backlogは空文字列(プレフィックスなし)
    },

    /**
     * 課題情報を取得する
     *
     * @param {Object} config - Backlog設定
     * @param {string} issueKey - 課題キー(例: PROJ-123)
     * @param {Object} options - オプション
     * @returns {Promise<Object>} 課題情報
     */
    async fetch(config, issueKey, options = {}) {
        debug('Backlogプラグイン: fetch', { issueKey });
        return await fetchIssue(config, issueKey, options);
    },

    /**
     * 課題情報を更新する
     *
     * @param {Object} config - Backlog設定
     * @param {string} issueKey - 課題キー(backlog_keyから取得)
     * @param {Object} updateData - 更新データ
     * @returns {Promise<Object>} 更新結果
     */
    async update(config, issueKey, updateData = {}) {
        debug('Backlogプラグイン: update', { issueKey });
        return await updateIssue(config, issueKey, updateData);
    },

    /**
     * YAMLフロントマターからチケットIDを抽出する
     *
     * @param {Object} frontmatter - YAMLフロントマター
     * @returns {string|null} チケットID
     */
    extractTicketId(frontmatter) {
        return frontmatter.backlog_key || null;
    },

    /**
     * 更新時に使用可能なオプションを返す
     *
     * @returns {Array<Object>} オプション一覧
     */
    getUpdateOptions() {
        return [
            { name: 'summary', description: '件名', type: 'string' },
            { name: 'start-date', description: '開始日(YYYY-MM-DD)', type: 'string' },
            { name: 'due-date', description: '期限日(YYYY-MM-DD)', type: 'string' },
            { name: 'estimated-hours', description: '予定時間', type: 'number' },
            { name: 'actual-hours', description: '実績時間', type: 'number' },
        ];
    },

    /**
     * 設定を検証する
     *
     * @param {Object} config - Backlog設定
     * @returns {Promise<Object>} 検証結果
     */
    async validate(config) {
        debug('Backlogプラグイン: validate');

        const errors = [];

        if (!config.url) {
            errors.push('Backlog URLが設定されていません (integration.pm_tool.backlog.url)');
        }

        if (!config.api_key) {
            errors.push('Backlog APIキーが設定されていません (integration.pm_tool.backlog.api_key)');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
};
