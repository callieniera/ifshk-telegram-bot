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
				if (serviceMsg.ok) this.#instances.telegram.methods.deleteMessage(chat_info.id, serviceMsg.result.message_id);
				await this.#instances.telegram.utils.sendCheckinQRCode(user_info, submitRes.agnetName, evtObj.id, opt);
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
}

export default TelegramMessagesHandlers;
