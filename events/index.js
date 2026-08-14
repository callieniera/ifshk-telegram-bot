import { classes } from "../helpers/index.js";
const { DBUtils } = classes;
import EventHandlers from "./handle.js";

class EventApp {
	constructor(instances) {
		this.#instances = instances;
		this.#instances.onclose.push(this.#writeNow.bind(this));
		this.#initOnStart();
	}
	#instances;

	#db = new DBUtils("events");

	#events = new Map();

	#inited = [];

	async #initOnStart() {
		const savedEvents = await this.#db.get("");
		if (savedEvents) {
			for (const eventIDRaw in savedEvents) {
				const evtObj = new EventHandlers(this.#instances, savedEvents[eventIDRaw]);
				await evtObj.initSync();
				this.#events.set(Number(eventIDRaw), evtObj);
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
		this.scheduleSave();
		return newEvent;
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
