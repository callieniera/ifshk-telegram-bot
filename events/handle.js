import * as cheerio from "cheerio";
import { getRange, updateRange, resolveTab, indexToA1 } from "./sheets.js";

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
		this.#initOnStart();
	}
	#instances;

	#opt = {
		sheetID: null,
		eventID: null,
		isTest: false,
	};

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
				leaderEnl: { name: this.#opt.isTest.username, username: String(this.#opt.isTest.username).toLocaleLowerCase() },
				leaderRes: { name: this.#opt.isTest.username, username: String(this.#opt.isTest.username).toLocaleLowerCase() },
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
		this.#userMap = new Map(Object.entries(object).map((v) => [Number(v[0]), v[1]]));
	}

	async submit(string, user_info) {
		const { ok, values, error } = this.#stringParser(string);
		if (!ok || error) return `Parse failed: ${error || "Unknown Error"}`;

		// Validate required fields
		const requiredKeys = ["AgentName", "AgentFaction", "Date(yyyy-mm-dd)", "Time(hh:mm:ss)", "Level", "LifetimeAP", "XMRecharged"];
		for (const key of requiredKeys) {
			if (values[key] === undefined || values[key] === "") {
				return `Missing or empty field: ${key}`;
			}
		}
		if (this.#opt.isTest && !this.#opt.sheetID) return true;
		const agentName = String(values["AgentName"]);
		const agentFaction = String(values["AgentFaction"]);
		const dateStr = String(values["Date(yyyy-mm-dd)"]);
		const timeStr = String(values["Time(hh:mm:ss)"]);
		const level = Number(values["Level"]);
		const lifetimeAP = Number(values["LifetimeAP"]);
		const xmRecharged = Number(values["XMRecharged"]);
		const release = await this.handleQueue();
		try {
			await this.initSync();
			const idx = await this.#getRowByAgentName(agentName);
			const value = { agentName, agentFaction, level, lifetimeAP, xmRecharged, id: user_info.id };
			const res = idx === -1 ? await this.#buildNewEntry(value) : await this.#updateEntry(idx, value);
			if (res && idx === -1) {
				this.#userMap.set(user_info.id, agentName);
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

	async #updateEntry(idx, values) {
		const token = await this.#instances.google.getServiceAccountToken();
		const currentValue = await getRange(token, this.#opt.sheetID, `'Data'!A${idx}:O${idx}`);
		const newValue = currentValue[0].map((v) => {
			if (v === "FALSE" || v === "TRUE") return v === "TRUE";
			if (v === "") return undefined;
			if (!isNaN(Number(v))) return Number(v);
			return v;
		});
		if (values.id !== newValue[2]) return `Telegram account not match.`;
		if (values.lifetimeAP > Number(newValue[9])) {
			newValue[7] = values.level;
			newValue[8] = undefined;
			newValue[10] = values.lifetimeAP;
			newValue[11] = undefined;
			newValue[13] = values.xmRecharged;
			newValue[14] = undefined;
		} else return "Lifetime AP hasn't been updated since the last submission.";
		try {
			await updateRange(token, this.#opt.sheetID, `'Data'!A${idx}:O${idx}`, [newValue]);
			return true;
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

	exportSaveData() {
		const exportValue = {
			...this.#opt,
		};
		exportValue.details = this.#details;
		exportValue.users = Object.fromEntries(this.#userMap.entries());
		return exportValue;
	}
}

export default EventHandlers;
