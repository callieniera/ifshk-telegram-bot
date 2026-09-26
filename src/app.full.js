class API {
	constructor() {
		this.API_BASE = (() => {
			const params = new URLSearchParams(location.search);
			const override = params.get("apiBase") || window.IFS_API_BASE;
			if (override && /^https?:\/\//i.test(override)) return override.replace(/\/+$/, "");
			return "https://api.akimiyabi.com/ifshk";
		})();
	}

	async getBotUsername() {
		try {
			const res = await fetch(`${this.API_BASE}/api/bot`);
			const data = await res.json().catch(() => ({}));
			if (!res.ok || !data.ok) throw new Error(data.error || "load_failed");
			return data.username || "HKFirstSaturdayBot";
		} catch (e) {
			console.error(e);
			return "HKFirstSaturdayBot";
		}
	}

	async loadEvents() {
		try {
			const res = await fetch(`${this.API_BASE}/api/events`, { method: "GET", credentials: "include" });
			const data = await res.json().catch(() => ({}));
			if (!res.ok || !data.ok) throw new Error(data.error || "load_failed");
			return Array.isArray(data.events) ? data.events : [];
		} catch (e) {
			console.error(e);
			return null;
		}
	}

	async loadStatus(eventId) {
		try {
			const res = await fetch(`${this.API_BASE}/api/events/${encodeURIComponent(eventId)}/status`, { method: "GET", credentials: "include" });
			const data = await res.json().catch(() => ({}));
			if (!res.ok && res.status === 404) return false;
			if (!res.ok || !data.ok) throw new Error(data.error || "load_failed");
			return data.result && typeof data.result === "object" ? data.result : data;
		} catch (e) {
			console.error(e);
			return null;
		}
	}

	async submit(eventId, stat) {
		try {
			const res = await fetch(`${this.API_BASE}/api/events/${encodeURIComponent(eventId)}/submit`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ stat }),
			});
			const data = await res.json().catch(() => ({}));
			if (res.ok && data.ok) return data.result;
			return data.error || false;
		} catch (e) {
			return false;
		}
	}
}

class App {
	constructor() {
		this.api = new API();
		this.statusTimer = null;
		this.restockTimer = null;
		this.statusRefresh = null;
		this.statusInterval = 5000;
		this.restockInterval = 15000;
		document.addEventListener("visibilitychange", () => {
			if (document.visibilityState === "visible") this.refreshCurrentStatus();
		});
		window.addEventListener("focus", () => this.refreshCurrentStatus());
		this.bootstrap();
	}

	clearStatusTimers() {
		if (this.statusTimer) clearInterval(this.statusTimer);
		if (this.restockTimer) clearTimeout(this.restockTimer);
		this.statusTimer = null;
		this.restockTimer = null;
		this.statusRefresh = null;
	}

	refreshCurrentStatus() {
		if (!document.querySelector("#submitBtn") || !document.querySelector(".status") || !this.statusRefresh) return;
		void this.statusRefresh();
	}

	async bootstrap() {
		this.clearStatusTimers();
		this.closeQR();
		this.renderLoading();
		this.bot_username = await this.api.getBotUsername();
		await this.getEventsAndRender();
	}

	renderLoading() {
		document.body.innerHTML =
			`<div class="screen" role="status" aria-live="polite">` +
			`<div class="spinner" aria-hidden="true"></div>` +
			`<h1 class="screen-title">請稍候...</h1>` +
			`</div>`;
	}

	async getEventsAndRender() {
		const list = await this.api.loadEvents();
		if (!list) return this.renderOperationalError("無法取得活動資訊", "請稍後再試", true);
		if (!list.length) return this.renderOperationalError("目前沒有活動進行中", "請稍後再試", true);
		if (list.length === 1) return this.renderSubmit(list[0]);

		document.body.innerHTML =
			`<div class="screen">` +
			`<h1 class="screen-title">選擇活動</h1>` +
			`<div class="event-list">` +
			list.map((event) => `<button class="btn-primary event-choice" data-event-id="${event.id}">${event.title || `活動 ${event.id}`}</button>`).join("") +
			`</div>` +
			`</div>`;
		document.querySelectorAll(".event-choice").forEach((button) => {
			button.addEventListener("click", () => this.renderSubmit(list.find((event) => String(event.id) === button.dataset.eventId)));
		});
	}

	renderOperationalError(title, description, canRetry) {
		document.body.innerHTML =
			`<div class="screen">` +
			`<h1 class="screen-title">${title || "遇到錯誤"}</h1>` +
			`<p class="screen-subtitle">${description || "請稍後再試"}</p>` +
			`<div class="screen-actions">${canRetry ? '<button id="retryBtn" class="btn-primary">重試</button>' : ""}</div>` +
			`</div>`;
		const retryBtn = document.querySelector("#retryBtn");
		if (retryBtn) retryBtn.addEventListener("click", () => this.bootstrap());
	}

	renderSubmit(event) {
		const eventId = event?.id;
		if (eventId == null) return this.renderOperationalError("活動資訊錯誤", "請稍後再試", true);
		this.clearStatusTimers();
		this.closeQR();
		document.body.innerHTML =
			`<div class="screen">` +
			`<h1 class="screen-title">${event.title || "提交活動數據"}</h1>` +
			`<button id="submitBtn" class="btn-primary">提交數據</button>` +
			`<div class="status" aria-live="polite"></div>` +
			`</div>`;
		const submitBtn = document.querySelector("#submitBtn");
		if (!submitBtn) return;
		this.renderStatus(eventId, event);
		submitBtn.addEventListener("click", async () => {
			submitBtn.disabled = true;
			try {
				document.querySelector("#error")?.remove();
				const input = typeof navigator.clipboard?.readText === "function" ? await navigator.clipboard.readText() : window.prompt("請貼上數據：");
				const stat = String(input || "").trim();
				if (!stat) throw new Error("提交失敗：沒有數據");
				const lines = stat.split("\n");
				if (lines.length !== 2) throw new Error("提交失敗：數據格式錯誤");
				const [keyStr, valueStr] = lines;
				const keys = keyStr.split("\t").filter((value) => value !== "");
				const values = String(valueStr || "")
					.split("\t")
					.filter((value) => value !== "");
				if (!keys.length || !values.length || keys.length !== values.length) throw new Error("提交失敗：數據格式錯誤");
				submitBtn.textContent = "提交中...";
				const result = await this.api.submit(eventId, stat);
				if (!result || typeof result === "string") throw new Error(result || "提交失敗");
				this.renderStatus(eventId, event);
			} catch (e) {
				submitBtn.parentElement.appendChild(
					Object.assign(document.createElement("p"), {
						id: "error",
						className: "screen-subtitle error-message",
						innerHTML: e.message || "提交失敗",
					})
				);
			} finally {
				submitBtn.textContent = "提交數據";
				submitBtn.disabled = false;
			}
		});
	}

	renderStatus(eventId, event) {
		this.clearStatusTimers();
		this.closeQR();
		const screen = document.querySelector(".status");
		if (!screen) return;
		screen.innerHTML = "<div class='spinner' aria-hidden='true'></div><p class='screen-subtitle'>載入中...</p>";
		let latestStatus = null;
		let refreshing = false;

		const refresh = async () => {
			if (refreshing) return;
			refreshing = true;
			try {
				const result = await this.api.loadStatus(eventId);
				if (!result) {
					if (result === false) return this.bootstrap();
					this.clearStatusTimers();
					screen.innerHTML = "";
					return;
				}
				latestStatus = result;
				this.renderStatusResult(screen, eventId, event, result);
				if (result.checkedIn) this.scheduleRestockStatus(eventId, event, result, refresh);
				else if (result.agentName && result.agentFaction && !this.statusTimer) {
					this.statusTimer = setInterval(() => void refresh(), this.statusInterval);
				}
			} finally {
				refreshing = false;
			}
		};

		this.statusRefresh = refresh;
		void refresh();
	}

	renderStatusResult(screen, eventId, event, result) {
		if (result.agentFaction) {
			document.body.classList.remove("faction-enlightened", "faction-resistance");
			document.body.classList.add(`faction-${String(result.agentFaction).toLowerCase()}`);
		}
		if (result.checkedIn) {
			if (this.statusTimer) clearInterval(this.statusTimer);
			this.statusTimer = null;
			this.closeQR();
		}
		const identity = result.agentName && result.agentFaction;
		screen.innerHTML = "";
		if (result.checkedIn) this.renderCheckedIn(screen);
		else if (identity) {
			this.renderQR(screen, eventId, result.agentName, result.agentFaction);
		}
		this.renderQualification(screen, result);
		if (result.passcode) this.renderPasscode(screen, result.passcode);
	}

	renderQR(screen, eventId, agentName, agentFaction) {
		const button = Object.assign(document.createElement("button"), { className: "btn-primary qr-button", type: "button", textContent: "顯示簽到 QR Code" });
		button.addEventListener("click", () => {
			this.closeQR();
			const overlay = Object.assign(document.createElement("div"), { className: "qr-overlay", id: "qrOverlay" });
			const close = Object.assign(document.createElement("button"), { className: "qr-close", type: "button", textContent: "×" });
			close.setAttribute("aria-label", "關閉 QR code");
			const container = Object.assign(document.createElement("div"), { className: "qr-fullscreen", id: "qrFullscreen" });
			overlay.append(close, container);
			document.body.appendChild(overlay);
			close.addEventListener("click", () => this.closeQR());
			const faction = String(agentFaction).toLowerCase();
			new QRCode(container, {
				text: `https://t.me/${this.bot_username}?start=checkin-${encodeURIComponent(eventId)}-${encodeURIComponent(agentName)}`,
				width: 280,
				height: 280,
				colorDark: faction.includes("enl") ? "#19c37d" : faction.includes("res") ? "#0b5a7a" : "#111111",
				colorLight: "#ffffff",
			});
		});
		screen.appendChild(button);
	}

	closeQR() {
		document.querySelector("#qrOverlay")?.remove();
	}

	renderCheckedIn(screen) {
		screen.appendChild(Object.assign(document.createElement("div"), { className: "status-inner status-checkin", innerHTML: "✅ 已簽到" }));
	}

	renderQualification(screen, result) {
		if (!result.checkedIn) return;
		const qualification = document.createElement("div");
		qualification.className = result.qualifies ? "status-inner qualification qualification-met" : "status-inner qualification";
		const ap = result.apGained == null ? "尚未提交第二次數據" : `AP 增加：${result.apGained}`;
		qualification.innerHTML = `<strong>${result.qualifies ? "已達成 IFS 參與要求" : "尚未達成 IFS 參與要求"}</strong><span>${ap}</span>`;
		screen.appendChild(qualification);
	}

	renderPasscode(screen, passcode) {
		const button = Object.assign(document.createElement("button"), { className: "btn-primary passcode-button", type: "button", textContent: "複製 Passcode" });
		button.addEventListener("click", async () => {
			try {
				await navigator.clipboard.writeText(String(passcode));
				button.textContent = "已複製";
			} catch (e) {
				button.textContent = "複製失敗";
			}
		});
		screen.appendChild(Object.assign(document.createElement("p"), { className: "passcode-label", textContent: `感謝參與！` }));
		screen.appendChild(button);
	}

	scheduleRestockStatus(eventId, event, result, refresh) {
		if (result.passcode || this.restockTimer) return;
		const restockAt = Date.parse(event?.restockTime);
		const delay = Number.isNaN(restockAt) || restockAt <= Date.now() ? this.restockInterval : restockAt - Date.now();
		this.restockTimer = setTimeout(async () => {
			this.restockTimer = null;
			await refresh();
		}, delay);
	}
}

export default new App();
