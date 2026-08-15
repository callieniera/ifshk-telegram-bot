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

	#reminderTimers = new Map();

	#inited = [];

	async #initOnStart() {
		const savedEvents = await this.#db.get("");
		if (savedEvents) {
			for (const eventIDRaw in savedEvents) {
				const evtObj = new EventHandlers(this.#instances, savedEvents[eventIDRaw]);
				await evtObj.initSync();
				this.#events.set(Number(eventIDRaw), evtObj);
				this.#scheduleDestroy(Number(eventIDRaw));
				this.#scheduleReminder(Number(eventIDRaw));
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
		this.#scheduleReminder(opt.eventID);
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
		const now = Date.now();
		const delayMs = Math.max(
			0,
			(eventObj.details.passcodeEndTime
				? new Date(eventObj.details.passcodeEndTime.getTime() + (eventObj.isTest ? 15 * 60 * 1000 : 2 * 60 * 60 * 1000))
				: new Date(now - ((now + 24 * 60 * 60 * 1000) % (24 * 60 * 60 * 1000)))
			).getTime() - now
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
		for (const timeout of this.#reminderTimers.values()) clearTimeout(timeout);
		this.#reminderTimers.clear();
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

	#scheduleReminder(eventID, retry = 0) {
		this.#clearReminder(eventID);
		const eventObj = this.#events.get(eventID);
		if (!eventObj) return;
		if (!eventObj.details?.restockTime && retry === 0) {
			eventObj.initSync().then(() => this.#scheduleReminder(eventID, retry + 1));
			return;
		}
		if (!eventObj.details.restockTime) return;
		const now = Date.now();
		const delayMs = new Date(eventObj.details.restockTime).getTime() - now;
		if (delayMs < 0) return;
		if (delayMs === 0) {
			void this.#broadcastReminder(eventID);
			return;
		}
		const timeout = setTimeout(() => {
			this.#reminderTimers.delete(eventID);
			void this.#broadcastReminder(eventID);
		}, delayMs);
		this.#reminderTimers.set(eventID, timeout);
		return;
	}

	#clearReminder(eventID) {
		const timeout = this.#reminderTimers.get(eventID);
		if (timeout) clearTimeout(timeout);
		this.#reminderTimers.delete(eventID);
		return;
	}

	async #broadcastReminder(eventID) {
		const eventObj = this.#events.get(eventID);
		if (!eventObj) return;
		const { noEndStat, notMeeting } = await eventObj.getReminderRecipients();
		const title = eventObj.details.title;
		const sendTo = async (recipients, text) => {
			await Promise.all(
				recipients.map(async (userObj) => {
					try {
						const res = await this.#instances.telegram?.methods?.sendMessage(userObj.id, text);
						if (res?.ok) eventObj.noteMessage(userObj.id, res.result.message_id);
					} catch (e) {
						console.error(e);
					}
				})
			);
		};
		if (noEndStat.length) await sendTo(noEndStat, `<b>Reminder:</b> Please submit your end stat for <i>${title}</i>.`);
		if (notMeeting.length) await sendTo(notMeeting, `<b>Reminder:</b> Your lifetime AP gain is below 10,000. Please re-submit your end stat.`);
		await eventObj.broadcastPasscode();
		return;
	}

	getLeaderEvents(username) {
		const events = [];
		for (const eventObj of this.#events.values())
			if (eventObj.details.leaderEnl.username === username.toLocaleLowerCase() || eventObj.details.leaderRes.username === username.toLocaleLowerCase())
				events.push(eventObj);
		return events;
	}

	getCurrentEvent() {
		const now = new Date();
		const events = [];
		for (const eventObj of this.#events.values())
			if (
				eventObj.sheetID &&
				eventObj.details.passcodeStartTime < now &&
				now < new Date(eventObj.details.passcodeEndTime.getTime() + (eventObj.isTest ? 15 * 60 * 1000 : 2 * 60 * 60 * 1000))
			)
				events.push(eventObj);
		return events;
	}

	getEvent(eventID) {
		return this.#events.get(Number(eventID)) || null;
	}

	destroyEvent(eventID) {
		this.#clearDestroy(eventID);
		if (this.#events.has(eventID)) {
			const eventObj = this.#events.get(eventID);
			this.#events.delete(eventID);
			this.scheduleSave();
			void this.#deleteEventMessages(eventObj);
			}
		return;
	}

	async #deleteEventMessages(eventObj) {
		if (!eventObj) return;
		const groups = eventObj.collectMessageDeletions();
		for (const group of groups) {
			try {
				await this.#instances.telegram?.methods?.deleteMessages(group.chat_id, group.message_ids);
			} catch (e) {
				console.error(e);
			}
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
