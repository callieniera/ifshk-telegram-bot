// IFSHK stat submission page — static front-end for the existing Fastify API.
//
// Flow mirrors the Telegram `stat` handler (see telegram/handlers/messages.js and
// events/handle.js): the user pastes a 2-line, tab-delimited "ALL TIME" stat block
// and it is POSTed to `/api/events/:eventId/submit`. The server mints/verifies an
// `ifs_token` cookie (seeded from Accept-Language) and returns either a localized
// error string or a result object:
//   - { agentName, agentFaction }  -> new agent (in Telegram this sends a QR code)
//   - { level, ap }                -> returning agent (stat updated)
//
// Language is chosen via the on-page switcher; it drives the `Accept-Language`
// header so the first message is localized. After the first submit the language is
// pinned in the server-issued cookie, so switching languages affects subsequent
// messages only on a fresh identity.

const UI = {
	en: {
		title: "Submit Stat",
		subtitle: "Paste the ALL TIME stat block from the Ingress game and submit it for the active event.",
		languageLabel: "Language",
		eventLabel: "Event",
		eventPlaceholder: "— select —",
		eventLoading: "Loading events…",
		eventNoActive: "No active event right now.",
		eventLoadError: "Could not load events. Check your connection or the API base URL.",
		statLabel: "Stat data",
		statHint:
			"Copy the ALL TIME stats from the Ingress app (the two-line, tab-separated block) and paste it here. Stats must be submitted within about 5 minutes of the in-game timestamp.",
		statPlaceholder: "Time Span\tAgent Name\t…\nALL TIME\t…",
		submitBtn: "Submit",
		submitting: "Submitting…",
		successReturned: "Submitted — Level {{level}} · AP {{ap}}",
		successNewAgent: "New agent registered: {{agentName}} ({{agentFaction}}). Show your check-in QR code to the event leader to receive your passcode.",
		errorTitle: "Submission failed",
		errorGeneric: "The submission could not be processed. Please try again.",
		errorNetwork: "Network error. Please check your connection and try again.",
		errorQr: "Could not generate the check-in QR code. Please try again.",
		retry: "You can paste the data and try again.",
		checkinTitle: "Check in",
		checkinCaption: "Please present this QR code to the event leader (PoC) to check in.",
		qrLoading: "Generating QR code\u2026",
		qrWaiting: "Waiting for the PoC to scan your QR code\u2026",
		qrCheckedIn: "You are checked in \u2705",
		requirementMet: "You meet the requirement \u2705 (+{{apGained}} AP)",
		requirementUnmet: "You don't meet the requirement yet \u2014 you need at least 10,000 AP gain (currently +{{apGained}}).",
		requirementPending: "Requirement check pending \u2014 submit your end stat first.",
	},
	"zh-HK": {
		title: "提交數據",
		subtitle: "將 Ingress 遊戲中的 ALL TIME 數據貼上，並為進行中的活動提交。",
		languageLabel: "語言",
		eventLabel: "活動",
		eventPlaceholder: "— 選擇 —",
		eventLoading: "正在載入活動……",
		eventNoActive: "目前沒有進行中的活動。",
		eventLoadError: "無法載入活動。請檢查網絡連接或 API 位址。",
		statLabel: "數據",
		statHint: "由 Ingress 應用複製 ALL TIME 數據（兩行、以 Tab 分隔的區塊）並貼上。數據須於遊戲內時間後約 5 分鐘內提交。",
		statPlaceholder: "Time Span\tAgent Name\t…\nALL TIME\t…",
		submitBtn: "提交",
		submitting: "正在提交……",
		successReturned: "已提交 — 等級 {{level}} · AP {{ap}}",
		successNewAgent: "已登記新特工：{{agentName}}（{{agentFaction}}）。請向活動負責人出示簽到二維碼以獲取 Passcode。",
		errorTitle: "提交失敗",
		errorGeneric: "無法處理提交，請重試。",
		errorNetwork: "網絡錯誤，請檢查連接後重試。",
		errorQr: "無法生成簽到二維碼，請重試。",
		retry: "你可以重新貼上數據並再試一次。",
		checkinTitle: "簽到",
		checkinCaption: "請向活動負責人（PoC）出示此二維碼以簽到。",
		qrLoading: "正在生成二維碼……",
		qrWaiting: "正在等待負責人掃描你的二維碼……",
		qrCheckedIn: "你已成功登記 \u2705",
		requirementMet: "你已符合參與資格 \u2705（+{{apGained}} AP）",
		requirementUnmet: "你尚未符合參與資格——需要至少 10,000 AP 的增益（目前 +{{apGained}}）。",
		requirementPending: "資格檢查待處理——請先提交結束數據。",
	},
	"zh-CN": {
		title: "提交数据",
		subtitle: "将 Ingress 游戏中的 ALL TIME 数据粘贴，并为进行中的活动提交。",
		languageLabel: "语言",
		eventLabel: "活动",
		eventPlaceholder: "— 选择 —",
		eventLoading: "正在加载活动……",
		eventNoActive: "目前没有进行中的活动。",
		eventLoadError: "无法加载活动，请检查网络连接或 API 地址。",
		statLabel: "数据",
		statHint: "从 Ingress 应用复制 ALL TIME 数据（两行、以 Tab 分隔的区块）并粘贴。数据须在游戏内时间后约 5 分钟内提交。",
		statPlaceholder: "Time Span\tAgent Name\t…\nALL TIME\t…",
		submitBtn: "提交",
		submitting: "正在提交……",
		successReturned: "已提交 — 等级 {{level}} · AP {{ap}}",
		successNewAgent: "已登记新特工：{{agentName}}（{{agentFaction}}）。请向活动负责人出示签到二维码以获取 Passcode。",
		errorTitle: "提交失败",
		errorGeneric: "无法处理提交，请重试。",
		errorNetwork: "网络错误，请检查连接后重试。",
		errorQr: "无法生成签到二维码，请重试。",
		retry: "你可以重新粘贴数据并再试一次。",
		checkinTitle: "签到",
		checkinCaption: "请向活动负责人（PoC）出示此二维码以签到。",
		qrLoading: "正在生成二维码……",
		qrWaiting: "正在等待负责人扫描你的二维码……",
		qrCheckedIn: "你已成功签到 \u2705",
		requirementMet: "你已符合参与资格 \u2705（+{{apGained}} AP）",
		requirementUnmet: "你尚未符合参与资格——需要至少 10,000 AP 的增益（目前 +{{apGained}}）。",
		requirementPending: "资格检查待处理——请先提交结束数据。",
	},
};

const LOCALES = Object.keys(UI);

// ---- API base resolution -----------------------------------------------------
// Default to same-origin; override via ?apiBase= or window.IFS_API_BASE.
function resolveApiBase() {
	const params = new URLSearchParams(location.search);
	const override = params.get("apiBase") || window.IFS_API_BASE;
	if (override && /^https?:\/\//i.test(override)) return override.replace(/\/+$/, "");
	return location.origin;
}

// ---- Language helpers --------------------------------------------------------
function mapLocale(raw) {
	if (!raw) return "en";
	const s = String(raw);
	if (/^zh/i.test(s)) {
		if (/cn|hans/i.test(s)) return "zh-CN";
		return "zh-HK";
	}
	if (/^en/i.test(s)) return "en";
	return "en";
}

function t(key, vars) {
	const dict = UI[lang] || UI.en;
	let str = dict[key] !== undefined ? dict[key] : UI.en[key] !== undefined ? UI.en[key] : key;
	if (vars) for (const k in vars) str = str.replaceAll(`{{${k}}}`, vars[k]);
	return str;
}

// ---- Minimal HTML sanitizer --------------------------------------------------
// Server i18n messages are trusted but contain limited markup (<b>, <i>, <code>,
// <a href="https://…"> and \n). Escape everything, then re-allow only a whitelist.
function sanitize(text) {
	if (text === undefined || text === null) return "";
	let s = String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
	s = s.replace(/\n/g, "<br>");
	s = s
		.replace(/&lt;(\/?b)&gt;/g, "<$1>")
		.replace(/&lt;(\/?i)&gt;/g, "<$1>")
		.replace(/&lt;(\/?code)&gt;/g, "<$1>")
		.replace(/&lt;a\s+href=(['"])(https?:\/\/[^'"]+)\1&gt;/g, '<a href="$1$2" target="_blank" rel="noopener noreferrer">')
		.replace(/&lt;\/a&gt;/g, "</a>");
	return s;
}

// ---- DOM refs ----------------------------------------------------------------
const langSelect = document.getElementById("lang");
const eventWrap = document.getElementById("eventWrap");
const eventSelect = document.getElementById("event");
const eventStatus = document.getElementById("eventStatus");
const statField = document.getElementById("statField");
const statInput = document.getElementById("stat");
const formActions = document.getElementById("formActions");
const submitBtn = document.getElementById("submit");
const statusEl = document.getElementById("status");
const form = document.getElementById("statForm");
const checkinEl = document.getElementById("checkin");
const qrcodeEl = document.getElementById("qrcode");
const qrcodeWrap = document.getElementById("qrcodeWrap");
const qrcodeState = document.getElementById("qrcodeState");
const checkinState = document.getElementById("checkinState");
const requirementEl = document.getElementById("requirement");

// ---- State -------------------------------------------------------------------
let lang = LOCALES.includes(localStorage.getItem("ifs_lang")) ? localStorage.getItem("ifs_lang") : mapLocale(navigator.language);

const API_BASE = resolveApiBase();
let eventState = "idle"; // "idle" | "loading" | "ready" | "empty" | "error"
const events = [];

// Check-in / requirement polling.
const POLL_INTERVAL_MS = 5000;
let pollTimer = null;
let checkedIn = false;
let lastAgent = null;

// ---- Rendering ---------------------------------------------------------------
function applyLabels() {
	document.documentElement.lang = lang;
	for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = t(el.getAttribute("data-i18n"));
	for (const el of document.querySelectorAll("[data-i18n-attr]")) el.setAttribute("placeholder", t(el.getAttribute("data-i18n-attr")));
	langSelect.value = lang;
	refreshCheckinLabels();
	refreshRequirementLabels();
	renderEventStatus();
	applyEventVisibility();
	updateSubmitEnabled();
}

function renderEventStatus() {
	const map = {
		idle: "",
		loading: t("eventLoading"),
		empty: t("eventNoActive"),
		ready: "",
		error: t("eventLoadError"),
	};
	eventStatus.textContent = map[eventState] || "";
	applyEventVisibility();
}

// Show / hide the event selector and the input rows based on how many events
// exist: 0 -> hide everything (form already shows the "no active event" message
// via eventStatus); 1 -> hide the selector (auto-selected in loadEvents); >1 ->
// show the selector so the user can choose.
function applyEventVisibility() {
	const hasEvents = eventState === "ready";
	if (eventState === "empty") {
		eventWrap.hidden = true;
		hideInputRows(true);
		return;
	}
	if (eventState === "loading" || eventState === "error") {
		eventWrap.hidden = true;
		hideInputRows(true);
		return;
	}
	// ready: exactly one event => hide the selector; otherwise show it.
	const single = eventSelect.options.length === 2; // placeholder + one event
	eventWrap.hidden = single;
	hideInputRows(false);
}

function hideInputRows(hidden) {
	statField.hidden = hidden;
	formActions.hidden = hidden;
	if (hidden) updateSubmitEnabled();
}

function updateSubmitEnabled() {
	const hasEvent = eventState === "ready" && eventSelect.value.length > 0;
	// Keep the button live while a submission is in flight (handled separately).
	if (submitBtn.dataset.busy === "1") return;
	submitBtn.disabled = !(hasEvent && statInput.value.trim().length > 0);
}

function showStatus(kind, html) {
	statusEl.hidden = false;
	statusEl.className = `status status--${kind}`;
	statusEl.innerHTML = html;
}

function clearStatus() {
	statusEl.hidden = true;
	statusEl.className = "status";
	statusEl.innerHTML = "";
}

function renderError(message) {
	const body = message && String(message).length ? sanitize(message) : sanitize(t("errorGeneric"));
	showStatus("error", `<p class="status__title">${sanitize(t("errorTitle"))}</p><p>${body}</p>`);
}

// ---- API ---------------------------------------------------------------------
async function loadEvents() {
	eventState = "loading";
	renderEventStatus();
	eventSelect.innerHTML = "";
	try {
		const res = await fetch(`${API_BASE}/api/events`, { headers: { "Accept-Language": lang } });
		const data = await res.json().catch(() => ({}));
		if (!res.ok || !data.ok) throw new Error(data.error || "load_failed");
		const list = Array.isArray(data.events) ? data.events : [];
		if (!list.length) {
			// No events: keep the empty state so renderEventStatus() shows the
			// "no active event" message and applyEventVisibility() hides the form.
			eventState = "empty";
		} else {
			const ph = document.createElement("option");
			ph.value = "";
			ph.textContent = t("eventPlaceholder");
			eventSelect.appendChild(ph);
			for (const evt of list) {
				const opt = document.createElement("option");
				opt.value = String(evt.id);
				opt.textContent = evt.title || `Event ${evt.id}`;
				eventSelect.appendChild(opt);
			}
			eventState = "ready";
			// Exactly one event: auto-select it (the selector is hidden by
			// applyEventVisibility). More than one: leave it for the user to choose.
			if (list.length === 1) eventSelect.value = String(list[0].id);
		}
	} catch (e) {
		eventState = "error";
	}
	renderEventStatus();
	updateSubmitEnabled();
}

async function submit() {
	const stat = statInput.value;
	const eventId = eventSelect.value;
	if (!stat.trim() || !eventId) return;

	// A fresh submit resets any in-flight check-in / requirement views.
	stopPolling();
	checkedIn = false;
	hideCheckin();
	hideRequirement();

	submitBtn.dataset.busy = "1";
	submitBtn.disabled = true;
	submitBtn.textContent = t("submitting");
	clearStatus();

	try {
		const res = await fetch(`${API_BASE}/api/events/${encodeURIComponent(eventId)}/submit`, {
			method: "POST",
			headers: { "Content-Type": "application/json", "Accept-Language": lang },
			credentials: "include",
			body: JSON.stringify({ stat }),
		});
		const data = await res.json().catch(() => ({}));
		if (res.ok && data.ok) renderSuccess(data.result);
		else renderError(data.error || t("errorGeneric"));
	} catch (e) {
		renderError(t("errorNetwork"));
	} finally {
		delete submitBtn.dataset.busy;
		submitBtn.textContent = t("submitBtn");
		updateSubmitEnabled();
	}
}

// ---- Check-in QR + scan-status (Feature 1 & 2) -------------------------------
function hideCheckin() {
	stopPolling();
	checkinEl.hidden = true;
	qrcodeEl.removeAttribute("src");
	qrcodeWrap.hidden = false;
	qrcodeState.hidden = true;
	checkinState.textContent = "";
}

function refreshCheckinLabels() {
	// The panel title/caption use data-i18n (updated by applyLabels); only the
	// dynamic status lines need explicit refresh here.
	if (!qrcodeState.hidden) qrcodeState.textContent = t("qrLoading");
	if (checkinEl.hidden) return;
	if (checkedIn) checkinState.textContent = t("qrCheckedIn");
	else if (pollTimer) checkinState.textContent = t("qrWaiting");
}

async function showCheckin(agent) {
	lastAgent = agent;
	checkedIn = false;
	checkinEl.hidden = false;
	qrcodeState.hidden = false;
	qrcodeState.textContent = t("qrLoading");
	qrcodeEl.hidden = true;
	qrcodeEl.removeAttribute("src");
	checkinState.textContent = t("qrWaiting");
	const eventId = eventSelect.value;
	const query = `agentName=${encodeURIComponent(agent.agentName)}&agentFaction=${encodeURIComponent(agent.agentFaction || "unknown")}`;
	try {
		const res = await fetch(`${API_BASE}/api/events/${encodeURIComponent(eventId)}/qrcode?${query}`, {
			headers: { "Accept-Language": lang },
			credentials: "include",
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok || !data.ok || !data.qrcode) throw new Error(data.error || "qr_failed");
		qrcodeEl.src = data.qrcode;
		qrcodeEl.hidden = false;
		qrcodeState.hidden = true;
	} catch (e) {
		qrcodeState.textContent = t("errorQr");
	}
	// Begin polling the status endpoint to detect a scan.
	startPolling(eventId);
}

async function fetchStatus(eventId) {
	const res = await fetch(`${API_BASE}/api/events/${encodeURIComponent(eventId)}/status`, {
		headers: { "Accept-Language": lang },
		credentials: "include",
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok || !data.ok) return null;
	return data;
}

// Poll GET /status every POLL_INTERVAL_MS until the agent is checked in, then
// hide the QR and announce the check-in. Stops on check-in or on any error.
function startPolling(eventId) {
	stopPolling();
	const tick = async () => {
		let status = null;
		try {
			status = await fetchStatus(eventId);
		} catch {
			// Transient network error: keep polling.
			return;
		}
		if (!status || status.agentName == null) return; // row not written yet
		if (status.checkedIn) {
			checkedIn = true;
			stopPolling();
			qrcodeEl.hidden = true;
			qrcodeWrap.hidden = true;
			checkinState.textContent = t("qrCheckedIn");
		}
	};
	pollTimer = setInterval(tick, POLL_INTERVAL_MS);
	// Kick an immediate check so a fast scan is not delayed a full interval.
	void tick();
}

function stopPolling() {
	if (pollTimer) {
		clearInterval(pollTimer);
		pollTimer = null;
	}
}

// ---- Requirement display (Feature 3) -----------------------------------------
function hideRequirement() {
	requirementEl.hidden = true;
	requirementEl.innerHTML = "";
	delete requirementEl.dataset.status;
}

function refreshRequirementLabels() {
	if (requirementEl.hidden) return;
	// Re-render from the last status if we have it.
	if (requirementEl.dataset.status) renderRequirement(JSON.parse(requirementEl.dataset.status));
}

function renderRequirement(status) {
	requirementEl.dataset.status = JSON.stringify(status);
	if (status.qualifies) {
		requirementEl.className = "status status--success";
		requirementEl.innerHTML = `<p class="status__title">${sanitize(t("requirementMet", { apGained: status.apGained ?? 0 }))}</p>`;
	} else if (status.apGained == null) {
		requirementEl.className = "status status--info";
		requirementEl.innerHTML = `<p>${sanitize(t("requirementPending"))}</p>`;
	} else {
		requirementEl.className = "status status--error";
		requirementEl.innerHTML = `<p>${sanitize(t("requirementUnmet", { apGained: status.apGained }))}</p>`;
	}
	requirementEl.hidden = false;
}

async function showRequirement(eventId) {
	requirementEl.hidden = false;
	requirementEl.className = "status status--info";
	requirementEl.innerHTML = `<p>${sanitize(t("requirementPending"))}</p>`;
	try {
		const status = await fetchStatus(eventId);
		if (!status) {
			requirementEl.innerHTML = `<p>${sanitize(t("requirementPending"))}</p>`;
			return;
		}
		renderRequirement(status);
	} catch (e) {
		requirementEl.innerHTML = `<p>${sanitize(t("requirementPending"))}</p>`;
	}
}

// ---- Result routing ----------------------------------------------------------
function renderSuccess(result) {
	let html;
	if (result && result.agentName && result.agentFaction) {
		// New agent: show the success message and surface the check-in QR.
		html = `<p>${sanitize(t("successNewAgent", { agentName: result.agentName, agentFaction: result.agentFaction }))}</p>`;
		showStatus("success", html);
		hideRequirement();
		void showCheckin({ agentName: result.agentName, agentFaction: result.agentFaction });
	} else if (result && (result.level !== undefined || result.ap !== undefined)) {
		// Returning agent (2nd+ stat): show whether they meet the requirement.
		html = `<p>${sanitize(t("successReturned", { level: result.level ?? "", ap: result.ap ?? "" }))}</p>`;
		showStatus("success", html);
		hideCheckin();
		void showRequirement(eventSelect.value);
	} else {
		html = `<p>${sanitize(t("successReturned", { level: "", ap: "" }))}</p>`;
		showStatus("success", html);
	}
}

// ---- Wiring ------------------------------------------------------------------
langSelect.addEventListener("change", () => {
	lang = langSelect.value;
	localStorage.setItem("ifs_lang", lang);
	applyLabels();
});

eventSelect.addEventListener("change", () => {
	clearStatus();
	updateSubmitEnabled();
});

statInput.addEventListener("input", () => {
	clearStatus();
	updateSubmitEnabled();
});

form.addEventListener("submit", (e) => {
	e.preventDefault();
	submit();
});

// ---- Init --------------------------------------------------------------------
applyLabels();
loadEvents();
