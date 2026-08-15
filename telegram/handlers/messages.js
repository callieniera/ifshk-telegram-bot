class TelegramMessagesHandlers {
	constructor(instances) {
		this.#instances = instances;
		return;
	}
	#instances;

	stat(chat_info, user_info, message_info) {
		if (chat_info.id !== user_info.id) return false;
		const opt = {
			reply_parameters: {
				message_id: message_info.message_id,
				allow_sending_without_reply: true,
			},
		};
		setImmediate(async () => {
			const events = this.#instances.events.getCurrentEvent();
			if (!events.length) {
				this.#instances.telegram.methods.sendMessage(chat_info.id, `<i>Error: No available event.</i>`, opt);
				return;
			} else if (events.length === 1) {
				const evtObj = events[0];
				const serviceMsg = await this.#instances.telegram.methods.sendMessage(chat_info.id, `<i>Submitting, please wait...</i>`, opt);
				const submitRes = await evtObj.submit(String(message_info.content), user_info);
				if (!submitRes || typeof submitRes === "string") {
					const text = `<b>Failed to submit stat!</b>\nError: ${submitRes ? submitRes : "Internal Error"}`;
					if (serviceMsg.ok) this.#instances.telegram.methods.editMessageText(chat_info.id, serviceMsg.result.message_id, text);
					else this.#instances.telegram.methods.sendMessage(chat_info.id, text, opt);
					return;
				}
				if (typeof submitRes === "object") {
					if (serviceMsg.ok) this.#instances.telegram.methods.deleteMessage(chat_info.id, serviceMsg.result.message_id);
					await evtObj.sendCheckinQRCode(user_info, submitRes.agentName, evtObj.id, opt);
				} else {
					if (serviceMsg.ok)
						await this.#instances.telegram.methods.editMessageText(chat_info.id, serviceMsg.result.message_id, "<b>✅ Submitted end stat!</b>", opt);
					else await this.#instances.telegram.methods.sendMessage(chat_info.id, "<b>✅ Submitted end stat!</b>", opt);
				}
				return;
			} else if (events.length > 1) {
				const inline_keyboard = [];
				for (const evtObj of events) inline_keyboard.push([{ text: evtObj.details.title, callback_data: `stat_${evtObj.id}` }]);
				inline_keyboard.push([{ text: "Cancel", style: "danger", callback_data: "close" }]);
				opt.reply_markup = { inline_keyboard };
				await this.#instances.telegram.methods.sendMessage(chat_info.id, `<b>Please choose an event:</b>`, opt);
				return;
			}
		});
		return false;
	}

	sheet(chat_info, user_info, message_info) {
		if (chat_info.id !== user_info.id) return false;
		const opt = {
			reply_parameters: {
				message_id: message_info.message_id,
				allow_sending_without_reply: true,
			},
		};
		setImmediate(async () => {
			const events = this.#instances.events.getLeaderEvents(user_info.username);
			if (!events.length) {
				this.#instances.telegram.methods.sendMessage(chat_info.id, `<i>Error: No available event.</i>`, opt);
				return;
			} else if (events.length === 1) {
				const evtObj = events[0];
				const res = await evtObj.setSheet(message_info.content);
				if (res?.ok) this.#instances.events.scheduleSave();
				if (res?.ok) {
					this.#instances.telegram.methods.sendMessage(chat_info.id, `<b>✅ Sheet set!</b>\n<i>${evtObj.details.title}</i>`, opt);
				} else {
					const error =
						res?.error === "SHEET_ACCESS_DENIED"
							? `<i>Error: The bot can't access this sheet. Please share it with the service account.</i>`
							: res?.error === "SHEET_NOT_FOUND"
								? `<i>Error: Sheet not found.</i>`
								: `<b>Failed to set sheet!</b>\nError: ${res?.error || "Internal Error"}`;
					this.#instances.telegram.methods.sendMessage(chat_info.id, error, opt);
				}
				return;
			} else if (events.length > 1) {
				const inline_keyboard = [];
				for (const evtObj of events) inline_keyboard.push([{ text: evtObj.details.title, callback_data: `sheet_${evtObj.id}` }]);
				inline_keyboard.push([{ text: "Cancel", style: "danger", callback_data: "close" }]);
				opt.reply_markup = { inline_keyboard };
				await this.#instances.telegram.methods.sendMessage(chat_info.id, `<b>Please choose an event:</b>`, opt);
				return;
			}
		});
		return false;
	}
}

export default TelegramMessagesHandlers;
