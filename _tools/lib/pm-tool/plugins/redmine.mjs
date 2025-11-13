#!/usr/bin/env zx
//#region _tools/lib/pm-tool/common/logger.js
/**
* ログレベル定義
*/
const LOG_LEVELS = {
	DEBUG: 0,
	INFO: 1,
	WARN: 2,
	ERROR: 3
};
/**
* 現在のログレベル（環境変数PM_TOOL_LOG_LEVELで設定可能）
*/
const currentLogLevel = LOG_LEVELS[process.env.PM_TOOL_LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;
/**
* タイムスタンプを生成する
*
* @returns {string} ISO形式のタイムスタンプ
*/
function timestamp() {
	return (/* @__PURE__ */ new Date()).toISOString();
}
/**
* ログメッセージをフォーマットする
*
* @param {string} level - ログレベル
* @param {string} message - ログメッセージ
* @param {Object} [data] - 追加データ
* @returns {string} フォーマットされたログメッセージ
*/
function formatMessage(level, message, data) {
	let formatted = `[${timestamp()}] [${level}] ${message}`;
	if (data) formatted += ` ${JSON.stringify(data)}`;
	return formatted;
}
/**
* DEBUGレベルのログを出力する
*
* @param {string} message - ログメッセージ
* @param {Object} [data] - 追加データ
*/
function debug(message, data) {
	if (currentLogLevel <= LOG_LEVELS.DEBUG) console.debug(formatMessage("DEBUG", message, data));
}
/**
* INFOレベルのログを出力する
*
* @param {string} message - ログメッセージ
* @param {Object} [data] - 追加データ
*/
function info(message, data) {
	if (currentLogLevel <= LOG_LEVELS.INFO) console.info(formatMessage("INFO", message, data));
}
/**
* WARNレベルのログを出力する
*
* @param {string} message - ログメッセージ
* @param {Object} [data] - 追加データ
*/
function warn(message, data) {
	if (currentLogLevel <= LOG_LEVELS.WARN) console.warn(formatMessage("WARN", message, data));
}
/**
* ERRORレベルのログを出力する
*
* @param {string} message - ログメッセージ
* @param {Error|Object} [error] - エラーオブジェクトまたは追加データ
*/
function error(message, error$1) {
	if (currentLogLevel <= LOG_LEVELS.ERROR) {
		const data = error$1 instanceof Error ? {
			message: error$1.message,
			stack: error$1.stack
		} : error$1;
		console.error(formatMessage("ERROR", message, data));
	}
}

//#endregion
//#region _tools/lib/pm-tool/common/error.js
/**
* PM Tool基底エラークラス
*/
var PmToolError = class extends Error {
	constructor(message, code, details) {
		super(message);
		this.name = "PmToolError";
		this.code = code;
		this.details = details;
	}
};
/**
* 認証エラー
*/
var AuthenticationError = class extends PmToolError {
	constructor(message, details) {
		super(message, "AUTH_ERROR", details);
		this.name = "AuthenticationError";
	}
};
/**
* APIエラー
*/
var ApiError = class extends PmToolError {
	constructor(message, statusCode, details) {
		super(message, "API_ERROR", details);
		this.name = "ApiError";
		this.statusCode = statusCode;
	}
};
/**
* ネットワークエラー
*/
var NetworkError = class extends PmToolError {
	constructor(message, details) {
		super(message, "NETWORK_ERROR", details);
		this.name = "NetworkError";
	}
};
/**
* バリデーションエラー
*/
var ValidationError = class extends PmToolError {
	constructor(message, details) {
		super(message, "VALIDATION_ERROR", details);
		this.name = "ValidationError";
	}
};
/**
* エラーを適切な型に変換する
*
* @param {Error} error - 元のエラー
* @returns {PmToolError} 適切な型に変換されたエラー
*/
function normalizeError(error$1) {
	if (error$1 instanceof PmToolError) return error$1;
	if (error$1.name === "TypeError" && error$1.message.includes("fetch")) return new NetworkError("ネットワークエラーが発生しました", { originalError: error$1.message });
	return new PmToolError(error$1.message, "UNKNOWN_ERROR", {
		originalError: error$1.toString(),
		stack: error$1.stack
	});
}

//#endregion
//#region _tools/lib/pm-tool/common/retry.js
/**
* 指定ミリ秒待機する
*
* @param {number} ms - 待機時間（ミリ秒）
* @returns {Promise<void>}
*/
function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
* 指数バックオフでリトライを実行する
*
* @param {Function} fn - 実行する関数
* @param {Object} options - オプション
* @param {number} [options.maxRetries=3] - 最大リトライ回数
* @param {number} [options.initialDelay=1000] - 初回待機時間（ミリ秒）
* @param {number} [options.maxDelay=10000] - 最大待機時間（ミリ秒）
* @param {number} [options.backoffMultiplier=2] - バックオフ倍率
* @param {Function} [options.shouldRetry] - リトライすべきかを判定する関数
* @returns {Promise<*>} 関数の実行結果
* @throws {Error} すべてのリトライが失敗した場合
*/
async function retry(fn, options = {}) {
	const { maxRetries = 3, initialDelay = 1e3, maxDelay = 1e4, backoffMultiplier = 2, shouldRetry = () => true } = options;
	let lastError;
	let delay = initialDelay;
	for (let attempt = 0; attempt <= maxRetries; attempt++) try {
		debug(`実行試行 ${attempt + 1}/${maxRetries + 1}`);
		return await fn();
	} catch (error$1) {
		lastError = error$1;
		if (attempt === maxRetries) break;
		if (!shouldRetry(error$1)) {
			debug("リトライすべきでないエラーのため中断", { error: error$1.message });
			throw error$1;
		}
		warn(`実行失敗 (${attempt + 1}/${maxRetries + 1}): ${error$1.message}`, { nextRetryIn: delay });
		await sleep(delay);
		delay = Math.min(delay * backoffMultiplier, maxDelay);
	}
	throw lastError;
}
/**
* レート制限エラーかどうかを判定する
*
* @param {Error} error - エラーオブジェクト
* @returns {boolean} レート制限エラーの場合true
*/
function isRateLimitError(error$1) {
	return error$1.statusCode === 429;
}
/**
* 一時的なエラーかどうかを判定する
*
* @param {Error} error - エラーオブジェクト
* @returns {boolean} 一時的なエラーの場合true
*/
function isTransientError(error$1) {
	if (isRateLimitError(error$1)) return true;
	if (error$1.statusCode >= 500 && error$1.statusCode < 600) return true;
	if (error$1.name === "NetworkError") return true;
	if (error$1.code === "ETIMEDOUT" || error$1.code === "ESOCKETTIMEDOUT") return true;
	return false;
}

//#endregion
//#region _tools/lib/pm-tool/common/api.js
/**
* Basic認証ヘッダーを生成する
*
* @param {string} username - ユーザー名
* @param {string} password - パスワード
* @returns {string} Basic認証ヘッダー値
*/
function createBasicAuthHeader(username, password) {
	const credentials = `${username}:${password}`;
	return `Basic ${Buffer.from(credentials).toString("base64")}`;
}
/**
* HTTP APIリクエストを実行する
*
* @param {string} url - リクエストURL
* @param {Object} options - fetchオプション
* @param {Object} [retryOptions] - リトライオプション
* @returns {Promise<Object>} レスポンスオブジェクト
* @throws {ApiError|NetworkError|AuthenticationError} API呼び出しエラー
*/
async function apiRequest(url, options = {}, retryOptions = {}) {
	debug(`API Request: ${options.method || "GET"} ${url}`);
	const finalRetryOptions = {
		maxRetries: 3,
		shouldRetry: (error$1) => isTransientError(error$1),
		...retryOptions
	};
	try {
		return await retry(async () => {
			try {
				const response = await fetch(url, {
					timeout: 3e4,
					...options
				});
				debug(`API Response: ${response.status} ${response.statusText}`);
				if (response.status === 401) throw new AuthenticationError("認証に失敗しました。APIキーまたはトークンを確認してください", {
					url,
					status: response.status
				});
				if (response.status === 403) throw new AuthenticationError("アクセス権限がありません", {
					url,
					status: response.status
				});
				if (response.status === 429) {
					const retryAfter = response.headers.get("Retry-After");
					throw new ApiError("レート制限に達しました。しばらく待ってから再試行してください", response.status, { retryAfter });
				}
				if (response.status >= 500) {
					const text = await response.text();
					throw new ApiError("サーバーエラーが発生しました", response.status, { responseBody: text });
				}
				if (!response.ok) {
					const text = await response.text();
					throw new ApiError(`APIエラー: ${response.statusText}`, response.status, { responseBody: text });
				}
				const contentType = response.headers.get("content-type");
				if (contentType && contentType.includes("application/json")) return await response.json();
				return await response.text();
			} catch (error$1) {
				if (error$1 instanceof TypeError) throw new NetworkError("ネットワークエラーが発生しました", {
					url,
					originalError: error$1.message
				});
				throw error$1;
			}
		}, finalRetryOptions);
	} catch (error$1) {
		error(`API Request Failed: ${url}`, error$1);
		throw normalizeError(error$1);
	}
}
/**
* GETリクエストを実行する
*
* @param {string} url - リクエストURL
* @param {Object} [headers] - リクエストヘッダー
* @param {Object} [retryOptions] - リトライオプション
* @returns {Promise<Object>} レスポンスオブジェクト
*/
async function get(url, headers = {}, retryOptions = {}) {
	return apiRequest(url, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
			...headers
		}
	}, retryOptions);
}
/**
* PUTリクエストを実行する
*
* @param {string} url - リクエストURL
* @param {Object} body - リクエストボディ
* @param {Object} [headers] - リクエストヘッダー
* @param {Object} [retryOptions] - リトライオプション
* @returns {Promise<Object>} レスポンスオブジェクト
*/
async function put(url, body, headers = {}, retryOptions = {}) {
	return apiRequest(url, {
		method: "PUT",
		headers: {
			"Content-Type": "application/json",
			...headers
		},
		body: JSON.stringify(body)
	}, retryOptions);
}

//#endregion
//#region _tools/lib/pm-tool/plugins/redmine/fetch.js
/**
* Redmineチケット情報を取得する
*
* @param {Object} config - Redmine設定
* @param {string} ticketId - チケットID
* @param {Object} options - オプション
* @returns {Promise<Object>} チケット情報
*/
async function fetchTicket(config, ticketId, options = {}) {
	if (!config.url) throw new ValidationError("Redmine URLが設定されていません (integration.pm_tool.redmine.url)");
	const hasApiKey = !!config.api_key;
	const hasBasicAuth = !!(config.username && config.password);
	if (!hasApiKey && !hasBasicAuth) throw new ValidationError("Redmine認証情報が設定されていません。api_key または username/password のいずれかを設定してください");
	debug("Redmineチケット取得", {
		ticketId,
		url: config.url,
		authType: hasApiKey ? "api_key" : "basic"
	});
	const url = `${config.url}/issues/${ticketId}.json`;
	const headers = {};
	if (hasApiKey) headers["X-Redmine-API-Key"] = config.api_key;
	else headers["Authorization"] = createBasicAuthHeader(config.username, config.password);
	try {
		const response = await get(url, headers);
		info(`チケット #${ticketId} の情報を取得しました`);
		return formatAsYamlFrontmatter(response.issue);
	} catch (error$1) {
		if (error$1 instanceof ApiError && error$1.statusCode === 404) throw new ApiError(`チケット #${ticketId} が見つかりません (404 Not Found)`, 404, {
			ticketId,
			url
		});
		throw error$1;
	}
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
		} : void 0,
		tracker: issue.tracker ? {
			id: issue.tracker.id,
			name: issue.tracker.name
		} : void 0,
		status: issue.status ? {
			id: issue.status.id,
			name: issue.status.name
		} : void 0,
		priority: issue.priority ? {
			id: issue.priority.id,
			name: issue.priority.name
		} : void 0,
		author: issue.author ? {
			id: issue.author.id,
			name: issue.author.name
		} : void 0,
		assigned_to: issue.assigned_to ? {
			id: issue.assigned_to.id,
			name: issue.assigned_to.name
		} : void 0,
		category: issue.category ? {
			id: issue.category.id,
			name: issue.category.name
		} : void 0,
		estimated_hours: issue.estimated_hours,
		start_date: issue.start_date,
		due_date: issue.due_date,
		done_ratio: issue.done_ratio,
		created_on: issue.created_on,
		updated_on: issue.updated_on
	};
	removeUndefinedFields(meta);
	return {
		meta,
		body: issue.description ? issue.description.replace(/\r\n/g, "\n").replace(/\r/g, "\n") : "",
		title: issue.subject || ""
	};
}
/**
* オブジェクトからundefinedのフィールドを再帰的に削除する
*
* @param {Object} obj - 対象オブジェクト
*/
function removeUndefinedFields(obj) {
	Object.keys(obj).forEach((key) => {
		if (obj[key] === void 0) delete obj[key];
		else if (obj[key] !== null && typeof obj[key] === "object") removeUndefinedFields(obj[key]);
	});
}

//#endregion
//#region _tools/lib/pm-tool/plugins/redmine/update.js
/**
* Redmineチケット情報を更新する
*
* @param {Object} config - Redmine設定
* @param {string} ticketId - チケットID
* @param {Object} updateData - 更新データ
* @returns {Promise<Object>} 更新結果
*/
async function updateTicket(config, ticketId, updateData = {}) {
	if (!config.url) throw new ValidationError("Redmine URLが設定されていません (integration.pm_tool.redmine.url)");
	const hasApiKey = !!config.api_key;
	const hasBasicAuth = !!(config.username && config.password);
	if (!hasApiKey && !hasBasicAuth) throw new ValidationError("Redmine認証情報が設定されていません。api_key または username/password のいずれかを設定してください");
	debug("Redmineチケット更新", {
		ticketId,
		updateData,
		authType: hasApiKey ? "api_key" : "basic"
	});
	const issueData = buildIssueUpdateData(updateData);
	if (Object.keys(issueData).length === 0) throw new ValidationError("更新する内容が指定されていません");
	const url = `${config.url}/issues/${ticketId}.json`;
	console.log("\n=== Redmine API更新ペイロード ===");
	console.log("URL:", url);
	console.log("Payload:", JSON.stringify({ issue: issueData }, null, 2));
	console.log("================================\n");
	if (updateData.dryRun || updateData["dry-run"]) {
		info("[DRY RUN] 実際の更新は行いません");
		return {
			success: true,
			message: `[DRY RUN] チケット #${ticketId} の更新をシミュレートしました`,
			updated: issueData,
			dryRun: true
		};
	}
	const headers = {};
	if (hasApiKey) headers["X-Redmine-API-Key"] = config.api_key;
	else headers["Authorization"] = createBasicAuthHeader(config.username, config.password);
	try {
		await put(url, { issue: issueData }, headers);
		info(`チケット #${ticketId} を更新しました`);
		return {
			success: true,
			message: `チケット #${ticketId} を更新しました`,
			updated: issueData
		};
	} catch (error$1) {
		if (error$1 instanceof ApiError && error$1.statusCode === 404) throw new ApiError(`チケット #${ticketId} が見つかりません (404 Not Found)`, 404, {
			ticketId,
			url
		});
		throw error$1;
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
	const body = updateData.body || "";
	if (updateData.comment) issueData.notes = updateData.comment;
	if (body) issueData.description = extractDescriptionFromMarkdown(body);
	if (updateData.status) issueData.status_id = parseInt(updateData.status, 10);
	else if (frontmatter.status?.id) issueData.status_id = frontmatter.status.id;
	if (updateData.assigned_to) issueData.assigned_to_id = parseInt(updateData.assigned_to, 10);
	else if (frontmatter.assigned_to?.id) issueData.assigned_to_id = frontmatter.assigned_to.id;
	if (updateData.done_ratio !== void 0) issueData.done_ratio = parseInt(updateData.done_ratio, 10);
	else if (frontmatter.done_ratio !== void 0) issueData.done_ratio = frontmatter.done_ratio;
	if (updateData.estimated_hours !== void 0) issueData.estimated_hours = parseFloat(updateData.estimated_hours);
	else if (frontmatter.estimated_hours !== null && frontmatter.estimated_hours !== void 0) issueData.estimated_hours = frontmatter.estimated_hours;
	if (updateData.start_date) issueData.start_date = updateData.start_date;
	else if (frontmatter.start_date) issueData.start_date = frontmatter.start_date;
	if (updateData.due_date) issueData.due_date = updateData.due_date;
	else if (frontmatter.due_date) issueData.due_date = frontmatter.due_date;
	if (updateData.priority) issueData.priority_id = parseInt(updateData.priority, 10);
	if (updateData.category) issueData.category_id = parseInt(updateData.category, 10);
	return issueData;
}
/**
* Markdown本文からdescription（説明）を抽出する
* h1見出しを除去し、残りの本文を返す
*
* 注: この関数は既にLFに正規化された本文を受け取ることを前提とする
*
* @param {string} body - Markdown本文（LF改行）
* @returns {string} 説明（h1見出しを除いた本文）
*/
function extractDescriptionFromMarkdown(body) {
	if (!body) return "";
	const setextMatch = body.match(/^[^\n]+\n=+\n+(.+)$/s);
	if (setextMatch) return setextMatch[1].trim();
	const atxMatch = body.match(/^#\s+[^\n]+\n+(.+)$/s);
	if (atxMatch) return atxMatch[1].trim();
	return body.trim();
}

//#endregion
//#region _tools/lib/pm-tool/plugins/redmine/index.js
/**
* Redmineプラグイン
*/
var redmine_default = {
	name: "redmine",
	label: "Redmine",
	defaults: { file_prefix: "ticket-" },
	async fetch(config, ticketId, options = {}) {
		debug("Redmineプラグイン: fetch", { ticketId });
		return await fetchTicket(config, ticketId, options);
	},
	async update(config, ticketId, updateData = {}) {
		debug("Redmineプラグイン: update", { ticketId });
		return await updateTicket(config, ticketId, updateData);
	},
	extractTicketId(frontmatter) {
		return frontmatter.id || null;
	},
	getUpdateOptions() {
		return [
			{
				name: "comment",
				description: "コメント",
				type: "string"
			},
			{
				name: "status",
				description: "ステータスID",
				type: "number"
			},
			{
				name: "assigned-to",
				description: "担当者ID",
				type: "number"
			},
			{
				name: "done-ratio",
				description: "進捗率(0-100)",
				type: "number"
			},
			{
				name: "estimated-hours",
				description: "予定工数",
				type: "number"
			},
			{
				name: "start-date",
				description: "開始日(YYYY-MM-DD)",
				type: "string"
			},
			{
				name: "due-date",
				description: "期日(YYYY-MM-DD)",
				type: "string"
			},
			{
				name: "priority",
				description: "優先度ID",
				type: "number"
			},
			{
				name: "category",
				description: "カテゴリID",
				type: "number"
			}
		];
	},
	async validate(config) {
		debug("Redmineプラグイン: validate");
		const errors = [];
		if (!config.url) errors.push("Redmine URLが設定されていません (integration.pm_tool.redmine.url)");
		const hasApiKey = !!config.api_key;
		const hasBasicAuth = !!(config.username && config.password);
		if (!hasApiKey && !hasBasicAuth) errors.push("Redmine認証情報が設定されていません。api_key または username/password のいずれかを設定してください");
		if (!hasApiKey && config.username && !config.password) errors.push("usernameが設定されていますが、passwordが設定されていません");
		if (!hasApiKey && !config.username && config.password) errors.push("passwordが設定されていますが、usernameが設定されていません");
		return {
			valid: errors.length === 0,
			errors
		};
	}
};

//#endregion
export { redmine_default as default };