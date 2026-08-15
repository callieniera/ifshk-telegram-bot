class TelegramCommandHandlers {
	constructor(instances) {
		this.#instances = instances;
		return;
	}
	#instances;

	start(chat_info, user_info, message_info) {
		if (chat_info.id !== user_info.id) return false;
		const content = String(message_info.content || "");
		if (!content.length) return false;
		const idx = content.indexOf("-");
		const [command, value] = idx !== -1 ? [content.slice(0, idx), content.slice(idx + 1)] : [content];
		switch (command) {
			case "checkin": {
				if (!value) return false;
				const match = value.match(/^(\d+)-(.+)$/);
				if (!match) return false;
				const eventID = Number(match[1]);
				const agentName = decodeURIComponent(match[2]);
				const opt = {
					reply_parameters: {
						message_id: message_info.message_id,
						allow_sending_without_reply: true,
					},
				};
				setImmediate(async () => {
					try {
						const evtObj = this.#instances.events.getEvent(eventID);
						if (!evtObj) {
							await this.#instances.telegram.methods.sendMessage(chat_info.id, "<i>Error: Event not found.</i>", opt);
							return;
						}
						const res = await evtObj.markParticipated(agentName);
						if (res === "Agent not found!" || res === false) {
							await this.#instances.telegram.methods.sendMessage(
								chat_info.id,
								`<i>${res === "Agent not found!" ? "Agent not found!" : "Failed to mark as participated."}</i>`,
								opt
							);
							return;
						}
						const sent = evtObj.getSentCheckinQrCode(agentName);
						if (sent && sent.id === user_info.id)
							this.#instances.telegram.methods.deleteMessage(sent.id, sent.message_id).then((v) => {
								if (v.ok) evtObj.sentCheckinQrCodeDeleted(agentName);
							});
						this.#instances.telegram.methods.sendMessage(chat_info.id, `<b>✅ Checked in: ${agentName}</b>`, opt);
						this.#instances.telegram.methods.sendMessage(sent.id, "<b>✅ You are checked in!</b>");
					} catch (err) {
						if (err && err.message) this.#instances.telegram.methods.sendMessage(chat_info.id, `<i>${err.toString()}</i>`, opt);
					}
				});
			}
			default: {
				return false;
			}
		}
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
				const match = details.timezone.match(/([+-])(\d+)/);
				const formattedOffset = match ? `${match[1]}${match[2].padStart(2, "0")}:00` : "+00:00";
				const fromTime = Temporal.Instant.fromEpochMilliseconds(details.passcodeStartTime.getTime());
				const tillTime = Temporal.Instant.fromEpochMilliseconds(details.restockTime.getTime());
				const broadcastTime = Temporal.Instant.fromEpochMilliseconds(details.passcodeEndTime.getTime());
				const zonedFrom = fromTime.toZonedDateTimeISO(formattedOffset);
				const zonedTill = tillTime.toZonedDateTimeISO(formattedOffset);
				const zonedBroadcast = broadcastTime.toZonedDateTimeISO(formattedOffset);
				const text = [
					`IFS Event added: <i>${details.title} (${eventObj.id})</i>`,
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

	passcode(chat_info, user_info, message_info) {
		if (chat_info.id !== user_info.id) return false;
		const content = String(message_info.content || "");
		if (!content.length) return false;
		const opt = {
			reply_parameters: {
				message_id: message_info.message_id,
				allow_sending_without_reply: true,
			},
		};
		setImmediate(async () => {
			try {
				const now = new Date();
				const events = this.#instances.events
					.getLeaderEvents(user_info.username)
					.filter(
						(evtObj) =>
							evtObj.details.passcodeStartTime &&
							evtObj.details.passcodeEndTime &&
							evtObj.details.passcodeStartTime < now &&
							now < evtObj.details.passcodeEndTime
					);
				if (!events.length) return;
				else if (events.length === 1) {
					const evtObj = events[0];
					evtObj.passcode = content;
					this.#instances.telegram.methods.sendMessage(chat_info.id, `<b>✅ Passcode set</b>: <code>${content}</code>`, opt);
					return;
				} else if (events.length > 1) {
					const inline_keyboard = [];
					for (const evtObj of events) inline_keyboard.push([{ text: evtObj.details.title, callback_data: `passcode_${evtObj.id}` }]);
					inline_keyboard.push([{ text: "Cancel", style: "danger", callback_data: "close" }]);
					opt.reply_markup = { inline_keyboard };
					await this.#instances.telegram.methods.sendMessage(chat_info.id, `<b>Please choose an event:</b>`, opt);
					return;
				}
			} catch (err) {
				console.error(err);
			}
		});
		return false;
	}
}

export default TelegramCommandHandlers;
