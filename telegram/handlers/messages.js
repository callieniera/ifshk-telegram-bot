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
			const i18n = this.#instances.i18n;
			const events = this.#instances.events.getCurrentEvent();
			if (!events.length) {
				this.#instances.telegram.methods.sendMessage(chat_info.id, i18n.t(user_info, "error.no_event"), opt);
				return;
			} else if (events.length === 1) {
				const evtObj = events[0];
				evtObj.noteMessage(chat_info.id, message_info.message_id);
				const serviceMsg = await this.#instances.telegram.methods.sendMessage(chat_info.id, i18n.t(user_info, "success.submitting"), opt);
				const submitRes = await evtObj.submit(String(message_info.content), user_info);
				if (!submitRes || typeof submitRes === "string") {
					const text = i18n.t(user_info, "error.submit_failed", { error: submitRes || i18n.t(user_info, "error.submit_internal") });
					if (serviceMsg.ok) this.#instances.telegram.methods.editMessageText(chat_info.id, serviceMsg.result.message_id, text);
					else this.#instances.telegram.methods.sendMessage(chat_info.id, text, opt);
					return;
				}
				if (typeof submitRes === "object") {
					if (serviceMsg.ok) this.#instances.telegram.methods.deleteMessage(chat_info.id, serviceMsg.result.message_id);
					await evtObj.sendCheckinQRCode(user_info, submitRes, opt);
				} else {
					const submitted = i18n.t(user_info, "success.submitted");
					if (serviceMsg.ok) await this.#instances.telegram.methods.editMessageText(chat_info.id, serviceMsg.result.message_id, submitted, opt);
					else await this.#instances.telegram.methods.sendMessage(chat_info.id, submitted, opt);
				}
				return;
			} else if (events.length > 1) {
				const inline_keyboard = [];
				for (const evtObj of events) inline_keyboard.push([{ text: evtObj.details.title, callback_data: `stat_${evtObj.id}` }]);
				inline_keyboard.push([{ text: i18n.t(user_info, "button.cancel"), style: "danger", callback_data: "close" }]);
				opt.reply_markup = { inline_keyboard };
				await this.#instances.telegram.methods.sendMessage(chat_info.id, i18n.t(user_info, "prompt.choose_event"), opt);
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
			const i18n = this.#instances.i18n;
			const events = this.#instances.events.getLeaderEvents(user_info.username);
			if (!events.length) return;
			else if (events.length === 1) {
				const evtObj = events[0];
				const res = await evtObj.setSheet(message_info.content);
				if (res?.ok) this.#instances.events.scheduleSave();
				if (res?.ok) {
					this.#instances.telegram.methods.sendMessage(chat_info.id, i18n.t(user_info, "success.sheet_set", { title: evtObj.details.title }), opt);
				} else {
					const error =
						res?.error === "SHEET_ACCESS_DENIED"
							? i18n.t(user_info, "error.sq_access")
							: res?.error === "SHEET_NOT_FOUND"
								? i18n.t(user_info, "error.sq_notfound")
								: i18n.t(user_info, "error.sq_generic", { error: res?.error || i18n.t(user_info, "error.submit_internal") });
					this.#instances.telegram.methods.sendMessage(chat_info.id, error, opt);
				}
				return;
			} else if (events.length > 1) {
				const inline_keyboard = [];
				for (const evtObj of events) inline_keyboard.push([{ text: evtObj.details.title, callback_data: `sheet_${evtObj.id}` }]);
				inline_keyboard.push([{ text: i18n.t(user_info, "button.cancel"), style: "danger", callback_data: "close" }]);
				opt.reply_markup = { inline_keyboard };
				await this.#instances.telegram.methods.sendMessage(chat_info.id, i18n.t(user_info, "prompt.choose_event"), opt);
			}
		});
		return false;
	}
}

export default TelegramMessagesHandlers;
