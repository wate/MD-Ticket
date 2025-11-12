#!/usr/bin/env zx

/**
 * PM Tool基底エラークラス
 */
export class PmToolError extends Error {
    constructor(message, code, details) {
        super(message);
        this.name = 'PmToolError';
        this.code = code;
        this.details = details;
    }
}

/**
 * 設定エラー
 */
export class ConfigError extends PmToolError {
    constructor(message, details) {
        super(message, 'CONFIG_ERROR', details);
        this.name = 'ConfigError';
    }
}

/**
 * 認証エラー
 */
export class AuthenticationError extends PmToolError {
    constructor(message, details) {
        super(message, 'AUTH_ERROR', details);
        this.name = 'AuthenticationError';
    }
}

/**
 * APIエラー
 */
export class ApiError extends PmToolError {
    constructor(message, statusCode, details) {
        super(message, 'API_ERROR', details);
        this.name = 'ApiError';
        this.statusCode = statusCode;
    }
}

/**
 * ネットワークエラー
 */
export class NetworkError extends PmToolError {
    constructor(message, details) {
        super(message, 'NETWORK_ERROR', details);
        this.name = 'NetworkError';
    }
}

/**
 * バリデーションエラー
 */
export class ValidationError extends PmToolError {
    constructor(message, details) {
        super(message, 'VALIDATION_ERROR', details);
        this.name = 'ValidationError';
    }
}

/**
 * エラーを適切な型に変換する
 *
 * @param {Error} error - 元のエラー
 * @returns {PmToolError} 適切な型に変換されたエラー
 */
export function normalizeError(error) {
    if (error instanceof PmToolError) {
        return error;
    }

    // fetch APIのエラー
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
        return new NetworkError('ネットワークエラーが発生しました', {
            originalError: error.message
        });
    }

    // その他のエラー
    return new PmToolError(error.message, 'UNKNOWN_ERROR', {
        originalError: error.toString(),
        stack: error.stack
    });
}
