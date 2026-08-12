class TelegramCommandHandlers {
	constructor(instances) {
		this.#instances = instances;
		return;
	}
	#instances;

	start(chat_info, user_info, message_info) {
		return false;
	}

	async new(chat_info, user_info, message_info) {
		if (
			chat_info.id !== user_info.id ||
			!String(user_info.username || "").length ||
			!String(message_info.content || "").length ||
			!String(message_info.content).includes("https://fevgames.net/ifs/event/?e=")
		)
			return false;
		const opt = {
			reply_parameters: {
				message_id: message_info.message_id,
				allow_sending_without_reply: true,
			},
		};
		setImmediate(async () => {
			const eventID = Number(new URL(message_info.content).searchParams.get("e"));
			try {
				const eventObj = this.#instances.events.createNewEvent({ eventID: eventID });
				await eventObj.initSync();
				const details = eventObj.details;
				if (!details) throw new ReferenceError("Unable to retrieve event data.");
				if (Date.now() > details.restockTime.getTime()) throw new RangeError("Event ended.");
				const normalizedUserName = String(user_info.username).toLocaleLowerCase();
				if (details.leaderEnl.username !== normalizedUserName && details.leaderRes.username !== normalizedUserName) {
					if (!eventObj.sheetID) this.#instances.events.destroyEvent(eventID);
					return;
				}
				const match = details.timezone.match(/([+-])(\d+)/);
				const formattedOffset = match ? `${match[1]}${match[2].padStart(2, "0")}:00` : "+00:00";
				const fromTime = Temporal.Instant.fromEpochMilliseconds(details.passcodeStartTime.getTime());
				const tillTime = Temporal.Instant.fromEpochMilliseconds(details.restockTime.getTime());
				const broadcastTime = Temporal.Instant.fromEpochMilliseconds(details.passcodeEndTime.getTime());
				const zonedFrom = fromTime.toZonedDateTimeISO(formattedOffset);
				const zonedTill = tillTime.toZonedDateTimeISO(formattedOffset);
				const zonedBroadcast = broadcastTime.toZonedDateTimeISO(formattedOffset);
				const text = [
					`IFS Event added: <i>${details.title}</i>`,
					"",
					`Timezone: <b>${details.timezone}</b>`,
					`Accept stat from <b>${new Intl.DateTimeFormat("en-HK", {
						timeZone: zonedFrom.timeZoneId, // Inherits '+08:00' dynamically
						dateStyle: "short",
						timeStyle: "medium",
					}).format(zonedFrom.toInstant())}</b>`,
					`Accept stat till <b>${new Intl.DateTimeFormat("en-HK", {
						timeZone: zonedTill.timeZoneId, // Inherits '+08:00' dynamically
						dateStyle: "short",
						timeStyle: "medium",
					}).format(zonedTill.toInstant())}</b>`,
					`Remind broadcast <b>${new Intl.DateTimeFormat("en-HK", {
						timeZone: zonedBroadcast.timeZoneId, // Inherits '+08:00' dynamically
						dateStyle: "short",
						timeStyle: "medium",
					}).format(zonedBroadcast.toInstant())}</b>`,
				];
				this.#instances.telegram.methods.sendMessage(chat_info.id, text.join("\n"), opt);
			} catch (err) {
				if (err && err.message) this.#instances.telegram.methods.sendMessage(chat_info.id, `<i>${err.toString()}</i>`, opt);
			}
		});
		return false;
	}

	async test(chat_info, user_info, message_info) {
		if (chat_info.id !== user_info.id) return;
		const eventOpt = {
			eventID: 1,
			isTest: {
				username: user_info.username,
			},
		};
		const opt = {
			reply_parameters: {
				message_id: message_info.message_id,
				allow_sending_without_reply: true,
			},
		};
		setImmediate(async () => {
			try {
				const eventObj = this.#instances.events.createNewEvent(eventOpt);
				await eventObj.initSync();
				const details = eventObj.details;
				if (!details) throw new ReferenceError("Unable to retrieve event data.");
				if (Date.now() > details.restockTime.getTime()) throw new RangeError("Event ended.");
				const normalizedUserName = String(user_info.username).toLocaleLowerCase();
				if (details.leaderEnl.username !== normalizedUserName && details.leaderRes.username !== normalizedUserName) {
					if (!eventObj.sheetID) this.#instances.events.destroyEvent(1);
					return;
				}
				const match = details.timezone.match(/([+-])(\d+)/);
				const formattedOffset = match ? `${match[1]}${match[2].padStart(2, "0")}:00` : "+00:00";
				const fromTime = Temporal.Instant.fromEpochMilliseconds(details.passcodeStartTime.getTime());
				const tillTime = Temporal.Instant.fromEpochMilliseconds(details.restockTime.getTime());
				const broadcastTime = Temporal.Instant.fromEpochMilliseconds(details.passcodeEndTime.getTime());
				const zonedFrom = fromTime.toZonedDateTimeISO(formattedOffset);
				const zonedTill = tillTime.toZonedDateTimeISO(formattedOffset);
				const zonedBroadcast = broadcastTime.toZonedDateTimeISO(formattedOffset);
				const text = [
					`IFS Event added: <i>${details.title}</i>`,
					"",
					`Timezone: <b>${details.timezone}</b>`,
					`Accept stat from <b>${new Intl.DateTimeFormat("en-HK", {
						timeZone: zonedFrom.timeZoneId, // Inherits '+08:00' dynamically
						dateStyle: "short",
						timeStyle: "medium",
					}).format(zonedFrom.toInstant())}</b>`,
					`Accept stat till <b>${new Intl.DateTimeFormat("en-HK", {
						timeZone: zonedTill.timeZoneId, // Inherits '+08:00' dynamically
						dateStyle: "short",
						timeStyle: "medium",
					}).format(zonedTill.toInstant())}</b>`,
					`Remind broadcast <b>${new Intl.DateTimeFormat("en-HK", {
						timeZone: zonedBroadcast.timeZoneId, // Inherits '+08:00' dynamically
						dateStyle: "short",
						timeStyle: "medium",
					}).format(zonedBroadcast.toInstant())}</b>`,
				];
				this.#instances.telegram.methods.sendMessage(chat_info.id, text.join("\n"), opt);
			} catch (err) {
				if (err && err.message) this.#instances.telegram.methods.sendMessage(chat_info.id, `<i>${err.toString()}</i>`, opt);
			}
		});
		return false;
	}
}

export default TelegramCommandHandlers;
