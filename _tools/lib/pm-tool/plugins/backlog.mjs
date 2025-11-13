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
	} catch (error) {
		lastError = error;
		if (attempt === maxRetries) break;
		if (!shouldRetry(error)) {
			debug("リトライすべきでないエラーのため中断", { error: error.message });
			throw error;
		}
		warn(`実行失敗 (${attempt + 1}/${maxRetries + 1}): ${error.message}`, { nextRetryIn: delay });
		await sleep(delay);
		delay = Math.min(delay * backoffMultiplier, maxDelay);
	}
	throw lastError;
}

//#endregion
//#region _tools/lib/pm-tool/plugins/backlog/fetch.js
/**
* Backlog課題情報を取得する
*
* @param {Object} config - Backlog設定
* @param {string} issueKey - 課題キー(例: PROJ-123)
* @param {Object} options - オプション
* @returns {Promise<Object>} 課題情報({meta, title, body}形式)
*/
async function fetchIssue(config, issueKey, options = {}) {
	if (!config.url) throw new ValidationError("Backlog URLが設定されていません (integration.pm_tool.backlog.url)");
	if (!config.api_key) throw new ValidationError("Backlog APIキーが設定されていません (integration.pm_tool.backlog.api_key)");
	debug("Backlog課題取得", {
		issueKey,
		url: config.url
	});
	info(`Backlog課題を取得: ${issueKey}`);
	const issue = await retry(() => callBacklogApi(config, issueKey), {
		maxRetries: 3,
		shouldRetry: (error) => {
			return !(error instanceof AuthenticationError) && !(error instanceof ApiError && error.statusCode === 404);
		}
	});
	info("課題情報を取得しました", {
		key: issue.issueKey,
		summary: issue.summary
	});
	return formatAsYamlFrontmatter(issue);
}
/**
* Backlog APIを呼び出す
*
* @param {Object} config - Backlog設定
* @param {string} issueKey - 課題キー
* @returns {Promise<Object>} 課題情報
*/
async function callBacklogApi(config, issueKey) {
	const baseUrl = config.url.replace(/\/$/, "");
	const url = new URL(`${baseUrl}/api/v2/issues/${issueKey}`);
	url.searchParams.append("apiKey", config.api_key);
	debug("API リクエスト開始", { url: url.toString() });
	try {
		const response = await fetch(url.toString(), { headers: { "Content-Type": "application/json" } });
		debug("API レスポンス受信", {
			status: response.status,
			statusText: response.statusText
		});
		if (!response.ok) {
			const errorBody = await response.text();
			let errorMessage = `Backlog API エラー: ${response.status} ${response.statusText}`;
			try {
				const errorData = JSON.parse(errorBody);
				if (errorData.errors && errorData.errors.length > 0) errorMessage = errorData.errors.map((e) => e.message).join(", ");
			} catch {}
			if (response.status === 401) throw new AuthenticationError("認証に失敗しました。APIキーを確認してください。", {
				status: response.status,
				body: errorBody
			});
			if (response.status === 404) throw new ApiError("指定された課題が見つかりません。", response.status, { body: errorBody });
			throw new ApiError(errorMessage, response.status, { body: errorBody });
		}
		return await response.json();
	} catch (error) {
		if (error instanceof ValidationError || error instanceof AuthenticationError || error instanceof ApiError) throw error;
		if (error.name === "TypeError" && error.message.includes("fetch")) throw new NetworkError("ネットワークエラーが発生しました", { originalError: error.message });
		throw error;
	}
}
/**
* Backlog課題情報をYAMLフロントマター形式に変換する
*
* @param {Object} issue - Backlog課題情報
* @returns {Object} フロントマター形式のデータ({meta, title, body})
*/
function formatAsYamlFrontmatter(issue) {
	const meta = {
		backlog_id: issue.id,
		backlog_key: issue.issueKey,
		project_id: issue.projectId,
		title: issue.summary,
		type: issue.issueType?.name || "",
		status: issue.status?.name || "",
		priority: issue.priority?.name || "",
		assignee: issue.assignee?.name || "",
		created_at: issue.created,
		updated_at: issue.updated
	};
	if (issue.startDate) meta.start_date = issue.startDate;
	if (issue.dueDate) meta.due_date = issue.dueDate;
	if (issue.estimatedHours !== null && issue.estimatedHours !== void 0) meta.estimated_hours = issue.estimatedHours;
	if (issue.actualHours !== null && issue.actualHours !== void 0) meta.actual_hours = issue.actualHours;
	const body = issue.description || "";
	return {
		meta,
		title: issue.summary || "Untitled",
		body
	};
}

//#endregion
//#region _tools/lib/pm-tool/plugins/backlog/update.js
/**
* Backlog課題情報を更新する
*
* @param {Object} config - Backlog設定
* @param {string} issueKey - 課題キー
* @param {Object} updateData - 更新データ(frontmatter, body, コマンドラインオプション)
* @returns {Promise<Object>} 更新結果
*/
async function updateIssue(config, issueKey, updateData = {}) {
	if (!config.url) throw new ValidationError("Backlog URLが設定されていません (integration.pm_tool.backlog.url)");
	if (!config.api_key) throw new ValidationError("Backlog APIキーが設定されていません (integration.pm_tool.backlog.api_key)");
	info(`Backlog課題を更新: ${issueKey}`);
	const updatePayload = buildUpdatePayload(updateData, await retry(() => callBacklogGetApi(config, issueKey), {
		maxRetries: 3,
		shouldRetry: (error) => {
			return !(error instanceof AuthenticationError) && !(error instanceof ApiError && error.statusCode === 404);
		}
	}));
	if (Object.keys(updatePayload).length === 0) {
		info("更新する項目がありません");
		return {
			success: true,
			message: "更新する項目がありません"
		};
	}
	const updatedIssue = await retry(() => callBacklogUpdateApi(config, issueKey, updatePayload), {
		maxRetries: 2,
		shouldRetry: (error) => {
			return !(error instanceof AuthenticationError) && !(error instanceof ApiError && error.statusCode === 404) && !(error instanceof ApiError && error.statusCode === 400);
		}
	});
	info("課題を更新しました", {
		key: updatedIssue.issueKey,
		updated: Object.keys(updatePayload)
	});
	return {
		success: true,
		issue: updatedIssue
	};
}
/**
* Backlog課題取得APIを呼び出す
*
* @param {Object} config - Backlog設定
* @param {string} issueKey - 課題キー
* @returns {Promise<Object>} 課題情報
*/
async function callBacklogGetApi(config, issueKey) {
	const baseUrl = config.url.replace(/\/$/, "");
	const url = new URL(`${baseUrl}/api/v2/issues/${issueKey}`);
	url.searchParams.append("apiKey", config.api_key);
	debug("API リクエスト開始 (GET)", { url: url.toString() });
	return await handleApiResponse(await fetch(url.toString(), { headers: { "Content-Type": "application/json" } }));
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
	const baseUrl = config.url.replace(/\/$/, "");
	const url = new URL(`${baseUrl}/api/v2/issues/${issueKey}`);
	url.searchParams.append("apiKey", config.api_key);
	const formData = new URLSearchParams();
	for (const [key, value] of Object.entries(updatePayload)) if (value !== null && value !== void 0) formData.append(key, value);
	debug("API リクエスト開始 (PATCH)", {
		url: url.toString(),
		payload: updatePayload
	});
	return await handleApiResponse(await fetch(url.toString(), {
		method: "PATCH",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: formData.toString()
	}));
}
/**
* APIレスポンスを処理する
*
* @param {Response} response - fetchレスポンス
* @returns {Promise<Object>} パースされたJSONデータ
*/
async function handleApiResponse(response) {
	debug("API レスポンス受信", {
		status: response.status,
		statusText: response.statusText
	});
	if (!response.ok) {
		const errorBody = await response.text();
		let errorMessage = `Backlog API エラー: ${response.status} ${response.statusText}`;
		try {
			const errorData = JSON.parse(errorBody);
			if (errorData.errors && errorData.errors.length > 0) errorMessage = errorData.errors.map((e) => e.message).join(", ");
		} catch {}
		if (response.status === 401) throw new AuthenticationError("認証に失敗しました。APIキーを確認してください。", {
			status: response.status,
			body: errorBody
		});
		if (response.status === 404) throw new ApiError("指定された課題が見つかりません。", response.status, { body: errorBody });
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
	const payload = {};
	if (frontmatter.title && frontmatter.title !== originalIssue.summary) payload.summary = frontmatter.title;
	if (frontmatter.status && frontmatter.status !== originalIssue.status?.name) warn("ステータスの更新はサポートされていません。Backlog側で手動更新してください。", {
		current: originalIssue.status?.name,
		requested: frontmatter.status
	});
	if (frontmatter.due_date !== void 0) payload.dueDate = frontmatter.due_date || null;
	if (frontmatter.start_date !== void 0) payload.startDate = frontmatter.start_date || null;
	if (frontmatter.estimated_hours !== void 0) payload.estimatedHours = frontmatter.estimated_hours;
	if (frontmatter.actual_hours !== void 0) payload.actualHours = frontmatter.actual_hours;
	return payload;
}

//#endregion
//#region _tools/lib/pm-tool/plugins/backlog/index.js
/**
* Backlogプラグイン
*/
var backlog_default = {
	name: "backlog",
	label: "Backlog",
	defaults: { file_prefix: "" },
	async fetch(config, issueKey, options = {}) {
		debug("Backlogプラグイン: fetch", { issueKey });
		return await fetchIssue(config, issueKey, options);
	},
	async update(config, issueKey, updateData = {}) {
		debug("Backlogプラグイン: update", { issueKey });
		return await updateIssue(config, issueKey, updateData);
	},
	extractTicketId(frontmatter) {
		return frontmatter.backlog_key || null;
	},
	getUpdateOptions() {
		return [
			{
				name: "start-date",
				description: "開始日(YYYY-MM-DD)",
				type: "string"
			},
			{
				name: "due-date",
				description: "期限日(YYYY-MM-DD)",
				type: "string"
			},
			{
				name: "estimated-hours",
				description: "予定時間",
				type: "number"
			},
			{
				name: "actual-hours",
				description: "実績時間",
				type: "number"
			}
		];
	},
	async validate(config) {
		debug("Backlogプラグイン: validate");
		const errors = [];
		if (!config.url) errors.push("Backlog URLが設定されていません (integration.pm_tool.backlog.url)");
		if (!config.api_key) errors.push("Backlog APIキーが設定されていません (integration.pm_tool.backlog.api_key)");
		return {
			valid: errors.length === 0,
			errors
		};
	}
};

//#endregion
export { backlog_default as default };