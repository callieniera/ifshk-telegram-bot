import { functions } from "../../helpers/index.js";

class TelegramCallbackqueryHandlers {
	constructor(instances) {
		this.#instances = instances;
		return;
	}
	#instances;

	#cachedQuery = new Set();
	stat(chat_info, user_info, callback_info) {
		setImmediate(async () => {
			const opt = {
				reply_parameters: {
					message_id: callback_info.message_info.reply_to_message.message_id,
					allow_sending_without_reply: true,
				},
			};
			const events = this.#instances.events.getCurrentEvent();
			const evtObj = events.find((v) => v.id === Number(callback_info.value));
			if (!evtObj) {
				await this.#instances.telegram.methods.editMessageText(chat_info.id, `<i>Error: Event not found.</i>`, opt);
				return;
			}
			const serviceMsg = await this.#instances.telegram.methods.editMessageText(
				chat_info.id,
				callback_info.message_info.message_id,
				`<i>Submitting, please wait...</i>`,
				opt
			);
			const submitRes = await evtObj.submit(String(callback_info.message_info.reply_to_message.text), user_info);
			if (!submitRes || typeof submitRes === "string") {
				const text = `<b>Failed to submit stat!</b>\nError: ${submitRes ? submitRes : "Internal Error"}`;
				if (serviceMsg.ok) this.#instances.telegram.methods.editMessageText(chat_info.id, serviceMsg.result.message_id, text);
				else this.#instances.telegram.methods.sendMessage(chat_info.id, text, opt);
				return;
			}
			if (serviceMsg.ok) this.#instances.telegram.methods.deleteMessage(chat_info.id, serviceMsg.result.message_id);
			await this.#instances.telegram.utils.sendCheckinQRCode(user_info, submitRes.agnetName, evtObj.id, opt);
			return;
		});
		return false;
	}
}

export default TelegramCallbackqueryHandlers;
