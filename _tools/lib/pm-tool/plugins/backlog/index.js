#!/usr/bin/env zx

import { fetchIssue } from './issue/fetch.js';
import { updateIssue } from './issue/update.js';
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
    async issueFetch(config, issueKey, options = {}) {
        debug('Backlogプラグイン: issueFetch', { issueKey });
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
    async issueUpdate(config, issueKey, updateData = {}) {
        debug('Backlogプラグイン: issueUpdate', { issueKey });
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
     * URLから課題キーを抽出する
     *
     * @param {string} url - Backlog URL
     * @returns {string|null} 課題キー、抽出できない場合はnull
     */
    parseUrl(url) {
        try {
            const urlObj = new URL(url);
            // Backlog形式: /view/PROJECT-123
            const match = urlObj.pathname.match(/\/view\/([A-Z]+-\d+)/);
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
