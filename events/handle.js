import * as cheerio from "cheerio";
import { getRange, updateRange, resolveTab, indexToA1 } from "./sheets.js";
import { JSDOM } from "jsdom";
import * as nodeCanvas from "canvas";
import QRCodeStyling from "qr-code-styling";

class EventHandlers {
	constructor(instances, opt) {
		this.#instances = instances;
		for (const key in opt) {
			if (this.#opt.hasOwnProperty(key)) {
				this.#opt[key] = opt[key];
			}
		}
		if (opt.details) this.details = opt.details;
		if (opt.users) this.users = opt.users;
		if (opt.qrcodes) this.#sentCheckinQrCode = new Map(Object.entries(opt.qrcodes));
		if (opt.passcode) this.#passcode = opt.passcode;
		if (opt.sentPasscode) this.#sentPasscode = new Map(Object.entries(opt.sentPasscode));
		if (opt.messages)
			this.#messages = new Map(Object.entries(opt.messages).map(([chat_id, ids]) => [String(chat_id), new Set((ids || []).map((v) => Number(v)))]));
		this.#initOnStart();
	}
	#instances;

	#opt = {
		sheetID: null,
		eventID: null,
		isTest: false,
	};

	get isTest() {
		return !!this.#opt.isTest;
	}

	#inited = [];

	async #initOnStart() {
		if (this.#opt.isTest && !this.#details) {
			const now = new Date();
			this.#details = {
				eventDateTime: now,
				title: "Test " + now.toLocaleString(),
				timezone: "UTC+8",
				passcodeStartTime: now,
				mediaEndTime: new Date(now.getTime() + 15 * 60 * 1000),
				restockTime: new Date(now.getTime() + 15 * 60 * 1000),
				restockEndTime: new Date(now.getTime() + 30 * 60 * 1000),
				passcodeEndTime: new Date(now.getTime() + 30 * 60 * 1000),
				leaderEnl: { name: this.#opt.isTest.username, username: String(this.#opt.isTest.username).toLocaleLowerCase(), id: null },
				leaderRes: { name: this.#opt.isTest.username, username: String(this.#opt.isTest.username).toLocaleLowerCase(), id: null },
				baseIntel: null,
				baseGoogle: null,
				restockIntel: null,
				restockGoogle: null,
				channel: null,
			};
		} else if (!this.#details) await this.#retrieveEventData();
		this.#inited.forEach((r) => r(true));
		this.#inited = true;
		return;
	}

	async initSync() {
		if (this.#inited === true) return true;
		return await new Promise((r) => this.#inited.push(r));
	}

	#details;

	set details(data) {
		this.#details = data;
		["eventDateTime", "passcodeStartTime", "mediaEndTime", "restockTime", "restockEndTime", "passcodeEndTime"].forEach((key) => {
			this.#details[key] = new Date(this.#details[key]);
		});
		return;
	}

	get details() {
		return structuredClone(this.#details);
	}

	setLeaderID(leaderKey, id) {
		if (!["leaderEnl", "leaderRes"].includes(leaderKey)) return;
		if (!this.#details || !this.#details[leaderKey]) return;
		const leader = this.#details[leaderKey];
		if (leader.id) return;
		const numericID = Number(id);
		if (isNaN(numericID)) return;
		leader.id = numericID;
		this.#instances.events?.scheduleSave();
		return;
	}

	async #retrieveEventData() {
		const fevgamesResponse = await fetch(`https://fevgames.net/ifs/event/?e=${this.#opt.eventID}`);
		const fevgamesData = await fevgamesResponse.text();
		const $ = cheerio.load(fevgamesData);
		const details = $("div#listing");
		const title = details.find("h2").text();
		let eventDateTime = null;
		details.find("span.info").each((i, el) => {
			const text = $(el).text();
			const match = text.match(/document\.write\(jQuery\.format\.prettyDate\('([^']+)'\)\);/);
			if (match) {
				const dateString = match[1];
				const dateObj = new Date(dateString);
				eventDateTime = new Date(dateObj.getTime() - (dateObj.getTime() % (24 * 60 * 60 * 1000)) + dateObj.getTimezoneOffset() * 60 * 1000);
			}
		});

		const timeDetails = details.find("div.portalDetails");
		const handleTime = (timeString) => {
			const isPm = String(timeString).toLocaleLowerCase().includes("pm");
			const [time, _] = String(timeString).toLocaleLowerCase().split(" ");
			const [hours, minutes] = time.split(":").map(Number);
			let adjustedHours = hours;
			if (isPm && hours < 12) adjustedHours += 12;
			else if (!isPm && hours === 12) adjustedHours = 0;
			const result = new Date(eventDateTime);
			result.setHours(adjustedHours, minutes, 0, 0);
			return result;
		};
		const timezone = timeDetails.children().eq(2).text().split(" ").join("");
		const passcodeStartTime = handleTime(timeDetails.children().eq(4).text().trim());
		const mediaEndTime = handleTime(timeDetails.children().eq(6).text().trim());
		const restockTime = handleTime(timeDetails.children().eq(8).text().trim());
		const restockEndTime = handleTime(timeDetails.children().eq(10).text().trim());
		const passcodeEndTime = handleTime(timeDetails.children().eq(12).text().trim());
		const leaders = details.find("td.h3").parent().next();
		const leadersENLObj = leaders.find("a.enl");
		const leaderEnl = {
			name: leadersENLObj.text(),
			username: leadersENLObj.attr("href").includes("t.me") ? leadersENLObj.attr("href").split("/").pop().toLocaleLowerCase() : null,
			id: null,
		};
		const leadersRESObj = leaders.find("a.res");
		const leaderRes = {
			name: leadersRESObj.text(),
			username: leadersRESObj.attr("href").includes("t.me") ? leadersRESObj.attr("href").split("/").pop().toLocaleLowerCase() : null,
		};
		const [baseIntel, baseGoogle, restockIntel, restockGoogle, channel] = Array.from(details.find("a[target='_blank']")).map((el) => el.attribs.href);
		this.#details = {
			eventDateTime,
			title,
			timezone,
			passcodeStartTime,
			mediaEndTime,
			restockTime,
			restockEndTime,
			passcodeEndTime,
			leaderEnl,
			leaderRes,
			baseIntel,
			baseGoogle,
			restockIntel,
			restockGoogle,
			channel,
		};
		return;
	}

	get id() {
		return this.#opt.eventID;
	}

	#extractSpreadsheetId(url) {
		if (!url) return null;
		const match = String(url).match(/\/d\/([a-zA-Z0-9_-]+)\//);
		return match ? match[1] : null;
	}

	async setSheet(url) {
		const sid = this.#extractSpreadsheetId(url);
		const token = await this.#instances.google.getServiceAccountToken();
		try {
			await resolveTab(token, sid, 0);
			this.#opt.sheetID = sid;
			return { ok: true, sid: sid };
		} catch (err) {
			if (err.status === 403) return { ok: false, error: "SHEET_ACCESS_DENIED" };
			if (err.status === 404) return { ok: false, error: "SHEET_NOT_FOUND" };
			throw err;
		}
	}

	get sheetID() {
		return this.#opt.sheetID;
	}

	async #getRowByAgentName(agentName) {
		if (!this.#opt.sheetID) return false;
		const token = await this.#instances.google.getServiceAccountToken();
		const header = await getRange(token, this.#opt.sheetID, "'Data'!1:1");
		if (!header[0]) return false;
		const agentNameColumn = header[0].findIndex((v) => v.includes("Agent Name"));
		const columnA1 = indexToA1(agentNameColumn);
		const agentNameArr = await getRange(token, this.#opt.sheetID, `'Data'!${columnA1}:${columnA1}`);
		agentNameArr.splice(0, 1);
		const idx = agentNameArr.map(([v]) => (v && typeof v === "string" ? v.toLocaleLowerCase() : v)).indexOf(agentName.toLocaleLowerCase());
		return idx > -1 ? idx + 2 : idx;
	}

	#queue = [];
	#canDoNext = null;
	async handleQueue() {
		if (this.#canDoNext) await new Promise((resolve) => this.#queue.push(resolve));

		let resolveTask;
		this.#canDoNext = new Promise((resolve) => {
			const innerPromise = new Promise((resolveInner) => {
				resolveTask = resolveInner;
			});
			innerPromise.then(() => {
				if (this.#queue.length) {
					const [next] = this.#queue.splice(0, 1);
					setTimeout(next, 0);
				}
				this.#canDoNext = null;
				resolve();
			});
		});
		return resolveTask;
	}

	#userMap = new Map();

	set users(object) {
		this.#userMap = new Map(
			Object.entries(object).map((v) => {
				const info = v[1];
				return [Number(v[0]), typeof info === "object" && info ? info : { agentName: info, languageCode: undefined }];
			})
		);
	}

	async submit(string, user_info) {
		const i18n = this.#instances.i18n;
		const { ok, values, error } = this.#stringParser(string);
		if (!ok || error) return i18n.t(user_info, "error.parse_failed", { error: error || i18n.t(user_info, "error.parse_unknown") });

		// Validate required fields
		const requiredKeys = ["AgentName", "AgentFaction", "Date(yyyy-mm-dd)", "Time(hh:mm:ss)", "Level", "LifetimeAP", "XMRecharged"];
		for (const key of requiredKeys) {
			if (values[key] === undefined || values[key] === "") {
				return i18n.t(user_info, "error.missing_field", { field: key });
			}
		}
		const agentName = String(values["AgentName"]);
		const agentFaction = String(values["AgentFaction"]);
		const dateStr = String(values["Date(yyyy-mm-dd)"]);
		const timeStr = String(values["Time(hh:mm:ss)"]);
		if (!this.#isStatFresh(dateStr, timeStr)) return i18n.t(user_info, "error.stat_stale");
		const level = Number(values["Level"]);
		const lifetimeAP = Number(values["LifetimeAP"]);
		const xmRecharged = Number(values["XMRecharged"]);
		const release = await this.handleQueue();
		try {
			await this.initSync();
			const idx = await this.#getRowByAgentName(agentName);
			const value = { agentName, agentFaction, level, lifetimeAP, xmRecharged, id: user_info.id };
			const res = idx === -1 ? await this.#buildNewEntry(value) : await this.#updateEntry(idx, value, user_info);
			if (res && idx === -1) {
				this.#userMap.set(user_info.id, { agentName, languageCode: user_info.language_code });
				this.#instances.events.scheduleSave();
				return { agentName, agentFaction };
			}
			return res;
		} catch (e) {
			console.error(e);
		} finally {
			release();
		}
	}

	async markParticipated(agentName) {
		const release = await this.handleQueue();
		try {
			await this.initSync();
			const idx = await this.#getRowByAgentName(agentName);
			if (idx === -1) return `Agent not found!`;
			const token = await this.#instances.google.getServiceAccountToken();
			const [[value]] = await getRange(token, this.#opt.sheetID, `'Data'!A${idx}`);
			if (value === "TRUE") return true;
			try {
				await updateRange(token, this.#opt.sheetID, `'Data'!A${idx}`, [[true]]);
				return true;
			} catch (err) {
				console.error(err);
				return false;
			}
		} catch (e) {
			console.error(e);
		} finally {
			release();
		}
	}

	async getParticipatedList() {
		await this.initSync();
		if (!this.#opt.sheetID) return [];
		const token = await this.#instances.google.getServiceAccountToken();
		const value = await getRange(token, this.#opt.sheetID, "'Data'!A:E");
		value.splice(0, 1);
		return value.filter((v) => v.length >= 5 && v[0] === "TRUE").map((v) => ({ id: Number(v[2]), agentName: v[4] }));
	}

	async #buildNewEntry(values) {
		const token = await this.#instances.google.getServiceAccountToken();
		const header = await getRange(token, this.#opt.sheetID, "'Data'!1:1");
		const agentNameColumn = header[0].findIndex((v) => v.includes("Agent Name"));
		const columnA1 = indexToA1(agentNameColumn);
		const agentNameArr = await getRange(token, this.#opt.sheetID, `'Data'!${columnA1}:${columnA1}`);
		const idx = agentNameArr.length + 1;
		try {
			await updateRange(token, this.#opt.sheetID, `'Data'!A${idx}:M${idx}`, [
				[
					false,
					false,
					values.id,
					undefined,
					values.agentName,
					values.agentFaction,
					values.level,
					undefined,
					undefined,
					values.lifetimeAP,
					undefined,
					undefined,
					values.xmRecharged,
				],
			]);
			return true;
		} catch (err) {
			console.error(err);
			return false;
		}
	}

	async #updateEntry(idx, values, user_info) {
		const i18n = this.#instances.i18n;
		const token = await this.#instances.google.getServiceAccountToken();
		const currentValue = await getRange(token, this.#opt.sheetID, `'Data'!A${idx}:O${idx}`);
		const newValue = currentValue[0].map((v) => {
			if (v === "FALSE" || v === "TRUE") return v === "TRUE";
			if (v === "") return undefined;
			if (!isNaN(Number(v))) return Number(v);
			return v;
		});
		if (values.id !== newValue[2]) return i18n.t(user_info, "error.account_not_match");
		if (values.lifetimeAP > Number(newValue[9])) {
			newValue[7] = values.level;
			newValue[8] = undefined;
			newValue[10] = values.lifetimeAP;
			newValue[11] = undefined;
			newValue[13] = values.xmRecharged;
			newValue[14] = undefined;
		} else return i18n.t(user_info, "error.lifetime_ap");
		try {
			await updateRange(token, this.#opt.sheetID, `'Data'!A${idx}:O${idx}`, [newValue]);
			void this.#maybeSendPasscode(values, newValue);
			return {
				level: newValue[7] - newValue[6] < 0 ? "Recursed" : `+${newValue[7] - newValue[6]}`,
				ap: `+${newValue[10] - newValue[9]}${newValue[10] - newValue[9] >= 10000 ? " ✅ " : ""}`,
			};
		} catch (err) {
			console.error(err);
			return false;
		}
	}

	#stringParser(string) {
		if (!string.includes("ALL TIME")) return { ok: false, error: "Wrong_Value_Type" };
		const keys = [
			"Time Span",
			"Agent Name",
			"Agent Faction",
			"Date (yyyy-mm-dd)",
			"Time (hh:mm:ss)",
			"Level",
			"Lifetime AP",
			"Current AP",
			"Unique Portals Visited",
			"Unique Portals Drone Visited",
			"Furthest Drone Distance",
			"Portals Discovered",
			"Seer Points",
			"XM Collected",
			"OPR Agreements",
			"Portal Scans Uploaded",
			"Uniques Scout Controlled",
			"Resonators Deployed",
			"Links Created",
			"Control Fields Created",
			"Mind Units Captured",
			"Longest Link Ever Created",
			"Largest Control Field",
			"XM Recharged",
			"Portals Captured",
			"Unique Portals Captured",
			"Mods Deployed",
			"Hacks",
			"Drone Hacks",
			"Glyph Hack Points",
			"Overclock Hack Points",
			"Completed Hackstreaks",
			"Longest Sojourner Streak",
			"Resonators Destroyed",
			"Portals Neutralized",
			"Enemy Links Destroyed",
			"Enemy Fields Destroyed",
			"Battle Beacon Combatant",
			"Drones Returned",
			"Machina Links Destroyed",
			"Machina Resonators Destroyed",
			"Machina Portals Neutralized",
			"Machina Portals Reclaimed",
			"Max Time Portal Held",
			"Max Time Link Maintained",
			"Max Link Length x Days",
			"Max Time Field Held",
			"Largest Field MUs x Days",
			"Forced Drone Recalls",
			"Distance Walked",
			"Kinetic Capsules Completed",
			"Unique Missions Completed",
			"Research Bounties Completed",
			"Research Days Completed",
			"Mission Day(s) Attended",
			"NL-1331 Meetup(s) Attended",
			"First Saturday Events",
			"Second Sunday Events",
			"Clear Fields Events",
			"OPR Live Events",
			"Prime Challenges",
			"Intel Ops Missions",
			"Stealth Ops Missions",
			"Urban Ops Missions",
			"Agents Recruited",
			"Recursions",
			"Months Subscribed",
		];
		const valueSearch = ["ALL TIME"];
		const proccessString = (input, array) => {
			return array.reduce((string, value) => string.replace(value, value.split(" ").join("")), input);
		};
		const [keysRaw, valuesRaw] = String(string).split("\n");
		if (!valuesRaw) return { ok: false, error: "Invalid" };

		const keyString = proccessString(keysRaw, keys);
		const valuesString = proccessString(valuesRaw, valueSearch);

		const values = {};
		const keysArray = keyString.split(" ");
		const valuesArray = valuesString.split(" ").map((v) => (isNaN(Number(v)) ? v : Number(v)));
		for (const i in keysArray) {
			values[keysArray[i]] = valuesArray[i];
			if (keysArray[i] === "DistanceWalked") break;
		}
		return { ok: true, values: values };
	}

	#sentCheckinQrCode = new Map();

	#sentPasscode = new Map();

	#messages = new Map();

	getSentCheckinQrCode(agentName) {
		return this.#sentCheckinQrCode.get(agentName) || null;
	}

	sentCheckinQrCodeDeleted(agentName) {
		this.#sentCheckinQrCode.delete(agentName);
		this.#instances.events?.scheduleSave();
		return;
	}

	// Record any message (user or bot) tied to this event so it can be deleted on destroy.
	noteMessage(chat_id, message_id) {
		if (chat_id == null || message_id == null) return;
		const key = String(chat_id);
		const numeric = Number(message_id);
		if (Number.isNaN(numeric)) return;
		if (!this.#messages.has(key)) this.#messages.set(key, new Set());
		this.#messages.get(key).add(numeric);
		this.#instances.events?.scheduleSave();
		return;
	}

	// Collect all tracked message_ids grouped by chat_id, chunked to 100 (Telegram deleteMessages cap).
	collectMessageDeletions() {
		const groups = new Map();
		const add = (chat_id, message_id) => {
			const key = String(chat_id);
			const numeric = Number(message_id);
			if (numeric == null || Number.isNaN(numeric)) return;
			if (!groups.has(key)) groups.set(key, new Set());
			groups.get(key).add(numeric);
		};

		// Generic registry (user messages + bot confirmations).
		for (const [chat_id, set] of this.#messages.entries()) {
			for (const id of set) add(chat_id, id);
		}

		// Existing per-agent bot message maps: { id, message_id }.
		for (const entry of this.#sentCheckinQrCode.values()) add(entry?.id, entry?.message_id);
		for (const entry of this.#sentPasscode.values()) add(entry?.id, entry?.message_id);

		const result = [];
		for (const [chat_id, set] of groups.entries()) {
			const ids = [...set];
			for (let i = 0; i < ids.length; i += 100) result.push({ chat_id: Number(chat_id), message_ids: ids.slice(i, i + 100) });
		}
		return result;
	}

	async sendCheckinQRCode(user_info, { agentName, agentFaction }, opt) {
		try {
			const faction = String(agentFaction || "unknown").toLocaleLowerCase();
			const options = {
				width: 1080,
				height: 1080,
				data: `https://t.me/${process.env.TG_BOT_USERNAME}?start=checkin-${this.#opt.eventID}-${agentName}`,
				dotsOptions: {
					color: faction.includes("enl") ? "#19c37d" : faction.includes("res") ? "#0b5a7a" : "#ffffff",
					type: "extra-rounded",
				},
				backgroundOptions: {
					color: "#000000",
				},
				imageOptions: {
					saveAsBlob: true,
					crossOrigin: "anonymous",
					margin: 10,
					imageSize: 0.6,
				},
				margin: 54,
			};
			const qrCodeImage = new QRCodeStyling({
				jsdom: JSDOM, // this is required
				nodeCanvas, // this is required,
				...options,
			});
			const file = qrCodeImage.getRawData("png");
			const i18n = this.#instances.i18n;
			const message_options = {
				...opt,
				caption: i18n.t(user_info, "event.checkin_qrcode"),
				parse_mode: "html",
				show_caption_above_media: "true",
				protect_content: "true",
			};
			await this.#instances.telegram.methods.sendChatAction(user_info.id, "upload_photo");
			const tg_res = await this.#instances.telegram.methods.sendPhotoFile(user_info.id, await file, "qrcode.png", message_options);
			if (tg_res.ok) {
				this.#sentCheckinQrCode.set(agentName, { id: user_info.id, message_id: tg_res.result.message_id });
				this.#instances.events?.scheduleSave();
			}
		} catch (err) {
			console.error(err);
			const tg_res = await this.#instances.telegram.methods.sendMessage(user_info.id, this.#instances.i18n.t(user_info, "error.qr_failed"), opt);
			if (tg_res.ok) {
				this.#sentCheckinQrCode.set(agentName, { id: user_info.id, message_id: tg_res.result.message_id });
				this.#instances.events?.scheduleSave();
			}
		}
	}

	#passcode;

	get passcode() {
		return this.#passcode;
	}

	set passcode(value) {
		this.#passcode = String(value);
		this.#instances.events?.scheduleSave();
		return;
	}

	async getReminderRecipients() {
		await this.initSync();
		const noEndStat = [];
		const notMeeting = [];
		if (!this.#opt.sheetID) return { noEndStat, notMeeting };
		const token = await this.#instances.google.getServiceAccountToken();
		const rows = await getRange(token, this.#opt.sheetID, "'Data'!A:O");
		rows.splice(0, 1);
		const seen = { noEndStat: new Set(), notMeeting: new Set() };
		for (const row of rows) {
			const id = Number(row[2]);
			if (!id || Number.isNaN(id)) continue;
			const a = row[0];
			const h = row[7];
			const j = Number(row[9]);
			const k = row[10];
			const agentName = row[4];
			const hFilled = h !== "" && h != null;
			if (!hFilled) {
				if (seen.noEndStat.has(id)) continue;
				seen.noEndStat.add(id);
				noEndStat.push({ id, agentName });
				continue;
			}
			const apGained = Number(k) - j;
			if (!(apGained >= 10000)) {
				if (seen.notMeeting.has(id)) continue;
				seen.notMeeting.add(id);
				notMeeting.push({ id, agentName });
				continue;
			}
		}
		return { noEndStat, notMeeting };
	}

	#isStatFresh(dateStr, timeStr) {
		const timezone = this.#details?.timezone;
		if (!timezone) return false;
		const m = String(timezone).match(/([+-])(\d+)/);
		if (!m) return false;
		const offset = m[1] === "+" ? -Number(m[2]) : Number(m[2]);
		const parts = String(dateStr).split("-").map(Number);
		if (!parts.length) return false;
		const [y, mo, d] = parts;
		if ([y, mo, d].some((v) => Number.isNaN(v))) return false;
		const tparts = String(timeStr).split(":").map(Number);
		const [h, mi, s] = tparts;
		if (Number.isNaN(h) || Number.isNaN(mi)) return false;
		const localMs = Date.UTC(y, mo - 1, d, h, mi || 0, s || 0);
		const statTime = localMs + offset * 3600 * 1000;
		const diffMin = (Date.now() - statTime) / 60000;
		return diffMin <= 5 && diffMin >= -1;
	}

	#rowQualifiesForPasscode(row) {
		// Column C (idx 2) must be a numeric id
		const id = Number(row[2]);
		if (!id || Number.isNaN(id)) return false;
		// Column A (idx 0) must be TRUE (participated)
		const a = row[0];
		if (a !== "TRUE" && a !== "true" && a !== true) return false;
		// Column H (idx 7) and Column K (idx 10) must not be blank
		const h = row[7];
		const k = row[10];
		if (h === "" || h == null || k === "" || k == null || Number.isNaN(Number(k))) return false;
		// Column K - Column J (idx 9) must be >= 10000
		const j = Number(row[9]);
		return Number(k) - j >= 10000;
	}

	getLanguageCode(id) {
		return this.#userMap.get(Number(id))?.languageCode;
	}

	async getPasscodeRecipients() {
		await this.initSync();
		const recipients = [];
		if (!this.#opt.sheetID) return recipients;
		const token = await this.#instances.google.getServiceAccountToken();
		const rows = await getRange(token, this.#opt.sheetID, "'Data'!A:O");
		rows.splice(0, 1);
		const seen = new Set();
		for (const row of rows) {
			if (!this.#rowQualifiesForPasscode(row)) continue;
			const agentName = String(row[4]).toLocaleLowerCase();
			if (seen.has(agentName)) continue;
			seen.add(agentName);
			recipients.push({ id: Number(row[2]), agentName: row[4] });
		}
		return recipients;
	}

	async #sendPasscode(recipient) {
		if (typeof this.#passcode !== "string" || !this.#passcode.length) return;
		const i18n = this.#instances.i18n;
		const key = String(recipient.agentName).toLocaleLowerCase();
		if (this.#sentPasscode.has(key)) return;
		try {
			const opt = {
				protect_content: true,
				reply_markup: {
					inline_keyboard: [
						[{ text: i18n.translate(i18n.resolveLocale(this.getLanguageCode(recipient.id)), "passcode.copy_button"), copy_text: this.#passcode }],
					],
				},
			};
			const res = await this.#instances.telegram?.methods?.sendMessage(
				recipient.id,
				i18n.translate(i18n.resolveLocale(this.getLanguageCode(recipient.id)), "passcode.message", { title: this.#details.title }),
				opt
			);
			if (res?.ok) {
				this.#sentPasscode.set(key, { id: recipient.id, message_id: res.result.message_id });
				this.#instances.events?.scheduleSave();
			}
		} catch (e) {
			console.error(e);
		}
	}

	async broadcastPasscode() {
		if (typeof this.#passcode !== "string" || !this.#passcode.length) return;
		const recipients = await this.getPasscodeRecipients();
		for (const recipient of recipients) await this.#sendPasscode(recipient);
		return;
	}

	async #maybeSendPasscode(values, row) {
		try {
			const end = this.#details?.passcodeEndTime;
			if (!end) return;
			// Only after the passcode window has opened (event ended but not yet destroyed).
			if (Date.now() < new Date(end).getTime()) return;
			if (typeof this.#passcode !== "string" || !this.#passcode.length) return;
			if (!this.#rowQualifiesForPasscode(row)) return;
			void this.#sendPasscode({ id: values.id, agentName: values.agentName });
		} catch (e) {
			console.error(e);
		}
	}

	exportSaveData() {
		const exportValue = {
			...this.#opt,
		};
		exportValue.details = this.#details;
		exportValue.users = Object.fromEntries(this.#userMap.entries());
		exportValue.qrcodes = Object.fromEntries(this.#sentCheckinQrCode.entries());
		exportValue.passcode = this.#passcode;
		exportValue.sentPasscode = Object.fromEntries(this.#sentPasscode.entries());
		exportValue.messages = Object.fromEntries([...this.#messages.entries()].map(([chat_id, set]) => [chat_id, [...set]]));
		return exportValue;
	}
}

export default EventHandlers;
