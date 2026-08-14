import { classes } from "../helpers/index.js";
const { DBUtils } = classes;
import EventHandlers from "./handle.js";

class EventApp {
	constructor(instances) {
		this.#instances = instances;
		this.#instances.onclose.push(this.#clearAllTimers.bind(this));
		this.#instances.onclose.push(this.#writeNow.bind(this));
		this.#initOnStart();
	}
	#instances;

	#db = new DBUtils("events");

	#events = new Map();

	#timers = new Map();

	#inited = [];

	async #initOnStart() {
		const savedEvents = await this.#db.get("");
		if (savedEvents) {
			for (const eventIDRaw in savedEvents) {
				const evtObj = new EventHandlers(this.#instances, savedEvents[eventIDRaw]);
				await evtObj.initSync();
				this.#events.set(Number(eventIDRaw), evtObj);
				this.#scheduleDestroy(Number(eventIDRaw));
			}
		}
		this.#inited.forEach((r) => r(true));
		this.#inited = true;
		return;
	}

	async initSync() {
		if (this.#inited === true) return true;
		return await new Promise((r) => this.#inited.push(r));
	}

	createNewEvent(opt) {
		if (!opt.isTest && !opt.eventID) {
			throw new Error("Event ID is required to create a new event.");
		}
		if (!opt.isTest && this.#events.has(opt.eventID)) {
			throw new Error(`Event with ID ${opt.eventID} already exists.`);
		}
		if (opt.isTest) {
			const idArr = Array.from(this.#events.values()).map((v) => v.id);
			for (let min = 1; true; min++)
				if (!idArr.includes(min)) {
					opt.eventID = min;
					break;
				}
		}
		const newEvent = new EventHandlers(this.#instances, opt);
		this.#events.set(opt.eventID, newEvent);
		this.#scheduleDestroy(opt.eventID);
		this.scheduleSave();
		return newEvent;
	}

	noteLeaderSight(user_info) {
		if (!user_info || !user_info.id) return;
		const uname = String(user_info.username || "").toLocaleLowerCase();
		if (!uname) return;
		for (const eventObj of this.#events.values()) {
			try {
				if (eventObj.details.leaderEnl?.username === uname) eventObj.setLeaderID("leaderEnl", user_info.id);
				if (eventObj.details.leaderRes?.username === uname) eventObj.setLeaderID("leaderRes", user_info.id);
			} catch (e) {
				console.error(e);
			}
		}
		return;
	}

	#scheduleDestroy(eventID, retry = 0) {
		this.#clearDestroy(eventID);
		const eventObj = this.#events.get(eventID);
		if (!eventObj) return;
		if (!eventObj.details?.passcodeEndTime && retry === 0) {
			eventObj.initSync().then(() => this.#scheduleDestroy(eventID, retry + 1));
			return;
		}
		const delayMs = Math.max(
			0,
			(eventObj.details.passcodeEndTime
				? eventObj.details.passcodeEndTime
				: new Date(Date.now() - ((Date.now() + 24 * 60 * 60 * 1000) % (24 * 60 * 60 * 1000)))
			).getTime() - Date.now()
		);
		if (delayMs === 0) {
			void this.#destroyExpired(eventID);
			return;
		}
		const timeout = setTimeout(() => {
			this.#timers.delete(eventID);
			void this.#destroyExpired(eventID);
		}, delayMs);
		this.#timers.set(eventID, timeout);
		return;
	}

	#clearDestroy(eventID) {
		const timeout = this.#timers.get(eventID);
		if (timeout) clearTimeout(timeout);
		this.#timers.delete(eventID);
		return;
	}

	#clearAllTimers() {
		for (const timeout of this.#timers.values()) clearTimeout(timeout);
		this.#timers.clear();
		return;
	}

	async #destroyExpired(eventID) {
		if (!this.#events.has(eventID)) return;
		const details = this.#events.get(eventID).details;
		this.destroyEvent(eventID);
		for (const leader of [details.leaderEnl, details.leaderRes]) {
			if (!leader || !leader.id) continue;
			try {
				await this.#instances.telegram?.methods?.sendMessage(leader.id, `<b>IFS event ended</b>\n<i>${details.title}</i>`);
			} catch (e) {
				console.error(e);
			}
		}
		return;
	}

	getLeaderEvents(username) {
		const events = {};
		for (const [eventID, eventObj] of this.#events.entries())
			if (eventObj.details.leaderEnl.username === username || eventObj.details.leaderRes.username === username) events[eventID] = eventObj;
		return events;
	}

	getCurrentEvent() {
		const now = new Date();
		const events = [];
		for (const eventObj of this.#events.values())
			if (/*eventObj.sheetID && */ eventObj.details.passcodeStartTime < now && now < eventObj.details.passcodeEndTime) events.push(eventObj);
		return events;
	}
	destroyEvent(eventID) {
		this.#clearDestroy(eventID);
		if (this.#events.has(eventID)) {
			this.#events.delete(eventID);
			this.scheduleSave();
		}
		return;
	}

	#timeout;
	scheduleSave() {
		if (this.#timeout) clearTimeout(this.#timeout);
		this.#timeout = setTimeout(async () => {
			this.#timeout = undefined;
			await this.#writeNow();
		}, 15 * 1000);
	}

	async #writeNow() {
		const saves = {};
		for (const [eventID, eventObj] of this.#events.entries()) saves[eventID] = eventObj.exportSaveData();
		await this.#db.add("", saves);
	}
}

export default EventApp;
