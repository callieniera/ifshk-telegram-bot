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
					const i18n = this.#instances.i18n;
					try {
						const evtObj = this.#instances.events.getLeaderEvents(user_info.username).find((evt) => evt.id === eventID);
						if (!evtObj) return;
						evtObj.noteMessage(chat_info.id, message_info.message_id);
						const res = await evtObj.markParticipated(agentName);
						if (res === "Agent not found!" || res === false) {
							await this.#instances.telegram.methods.sendMessage(
								chat_info.id,
								`<i>${res === "Agent not found!" ? i18n.t(user_info, "error.agent_not_found") : i18n.t(user_info, "error.participate_failed")}</i>`,
								opt
							);
							return;
						}
						const sent = evtObj.getSentCheckinQrCode(agentName);
						if (sent && sent.id === user_info.id)
							this.#instances.telegram.methods.deleteMessage(sent.id, sent.message_id).then((v) => {
								if (v.ok) evtObj.sentCheckinQrCodeDeleted(agentName);
							});
						const checkedInRes = await this.#instances.telegram.methods.sendMessage(chat_info.id, i18n.t(user_info, "success.checked_in", { agentName }), opt);
						if (checkedInRes?.ok) evtObj.noteMessage(chat_info.id, checkedInRes.result.message_id);
						const agentRes = await this.#instances.telegram.methods.sendMessage(sent.id, i18n.t(user_info, "success.checked_in_self"));
						if (agentRes?.ok) evtObj.noteMessage(sent.id, agentRes.result.message_id);
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
			const i18n = this.#instances.i18n;
			const locale = i18n.resolveLocale(user_info?.language_code);
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
				const tillTime = Temporal.Instant.fromEpochMilliseconds(details.passcodeEndTime.getTime() + (eventObj.isTest ? 15 * 60 * 1000 : 2 * 60 * 60 * 1000));
				const broadcastTime = Temporal.Instant.fromEpochMilliseconds(details.restockTime.getTime());
				const zonedFrom = fromTime.toZonedDateTimeISO(formattedOffset);
				const zonedTill = tillTime.toZonedDateTimeISO(formattedOffset);
				const zonedBroadcast = broadcastTime.toZonedDateTimeISO(formattedOffset);
				const dateOpt = { timeZone: "Asia/Hong_Kong", dateStyle: "short", timeStyle: "medium" };
				const text = [
					i18n.t(user_info, "new.event_added", { title: details.title }),
					"",
					i18n.t(user_info, "new.timezone", { timezone: details.timezone }),
					i18n.t(user_info, "new.accept_from", { date: i18n.formatDate(zonedFrom.toInstant(), locale, { ...dateOpt, timeZone: zonedFrom.timeZoneId }) }),
					i18n.t(user_info, "new.accept_till", { date: i18n.formatDate(zonedTill.toInstant(), locale, { ...dateOpt, timeZone: zonedTill.timeZoneId }) }),
					i18n.t(user_info, "new.remind_broadcast", {
						date: i18n.formatDate(zonedBroadcast.toInstant(), locale, { ...dateOpt, timeZone: zonedBroadcast.timeZoneId }),
					}),
				];
				delete opt.reply_parameters;
				this.#instances.telegram.methods.deleteMessage(chat_info.id, message_info.message_id);
				this.#instances.telegram.methods.sendMessage(chat_info.id, text.join("\n"), opt);
			} catch (err) {
				if (err && err.message) this.#instances.telegram.methods.sendMessage(chat_info.id, `<i>${err.toString()}</i>`, opt);
			}
		});
		return false;
	}

	async test(chat_info, user_info, message_info) {
		if (chat_info.id !== user_info.id || !this.#instances.telegram.utils.isGlobalAdmin(user_info)) return false;
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
			const i18n = this.#instances.i18n;
			const locale = i18n.resolveLocale(user_info?.language_code);
			try {
				const eventObj = this.#instances.events.createNewEvent(eventOpt);
				await eventObj.initSync();
				const details = eventObj.details;
				const match = details.timezone.match(/([+-])(\d+)/);
				const formattedOffset = match ? `${match[1]}${match[2].padStart(2, "0")}:00` : "+00:00";
				const fromTime = Temporal.Instant.fromEpochMilliseconds(details.passcodeStartTime.getTime());
				const tillTime = Temporal.Instant.fromEpochMilliseconds(details.passcodeEndTime.getTime() + (eventObj.isTest ? 15 * 60 * 1000 : 2 * 60 * 60 * 1000));
				const broadcastTime = Temporal.Instant.fromEpochMilliseconds(details.restockTime.getTime());
				const zonedFrom = fromTime.toZonedDateTimeISO(formattedOffset);
				const zonedTill = tillTime.toZonedDateTimeISO(formattedOffset);
				const zonedBroadcast = broadcastTime.toZonedDateTimeISO(formattedOffset);
				const dateOpt = { timeZone: "Asia/Hong_Kong", dateStyle: "short", timeStyle: "medium" };
				const text = [
					i18n.t(user_info, "new.event_added_test", { title: details.title, id: eventObj.id }),
					"",
					i18n.t(user_info, "new.timezone", { timezone: details.timezone }),
					i18n.t(user_info, "new.accept_from", { date: i18n.formatDate(zonedFrom.toInstant(), locale, { ...dateOpt, timeZone: zonedFrom.timeZoneId }) }),
					i18n.t(user_info, "new.accept_till", { date: i18n.formatDate(zonedTill.toInstant(), locale, { ...dateOpt, timeZone: zonedTill.timeZoneId }) }),
					i18n.t(user_info, "new.remind_broadcast", {
						date: i18n.formatDate(zonedBroadcast.toInstant(), locale, { ...dateOpt, timeZone: zonedBroadcast.timeZoneId }),
					}),
				];
				delete opt.reply_parameters;
				this.#instances.telegram.methods.deleteMessage(chat_info.id, message_info.message_id);
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
			const i18n = this.#instances.i18n;
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
					evtObj.noteMessage(chat_info.id, message_info.message_id);
					evtObj.passcode = content;
					const passcodeRes = await this.#instances.telegram.methods.sendMessage(
						chat_info.id,
						i18n.t(user_info, "success.passcode_set", { passcode: content }),
						opt
					);
					if (passcodeRes?.ok) evtObj.noteMessage(chat_info.id, passcodeRes.result.message_id);
					return;
				} else if (events.length > 1) {
					const inline_keyboard = [];
					for (const evtObj of events) inline_keyboard.push([{ text: evtObj.details.title, callback_data: `passcode_${evtObj.id}` }]);
					inline_keyboard.push([{ text: i18n.t(user_info, "button.cancel"), style: "danger", callback_data: "close" }]);
					opt.reply_markup = { inline_keyboard };
					await this.#instances.telegram.methods.sendMessage(chat_info.id, i18n.t(user_info, "prompt.choose_event"), opt);
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
