import EventHandlers from "./handle.js";

class EventApp {
	constructor(instances) {
		this.#instances = instances;
	}
	#instances;

	#events = new Map();
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
		if (this.#events.has(eventID)) this.#events.delete(eventID);
		return;
	}
}

export default EventApp;
