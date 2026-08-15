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
			if (
				callback_info.message_info.reply_to_message?.message_id === undefined ||
				String(callback_info.message_info.reply_to_message?.text || "").length === 0
			) {
				await this.#instances.telegram.methods.editMessageText(
					chat_info.id,
					callback_info.message_info.message_id,
					`<i>Error: What are you submitting?</i>`,
					opt
				);
				return;
			}
			const opt = {
				reply_parameters: {
					message_id: callback_info.message_info.reply_to_message.message_id,
					allow_sending_without_reply: true,
				},
			};
			const events = this.#instances.events.getCurrentEvent();
			const evtObj = events.find((v) => v.id === Number(callback_info.value));
			if (!evtObj) {
				await this.#instances.telegram.methods.editMessageText(chat_info.id, callback_info.message_info.message_id, `<i>Error: Event not found.</i>`, opt);
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
			if (typeof submitRes === "object") {
				if (serviceMsg.ok) this.#instances.telegram.methods.deleteMessage(chat_info.id, serviceMsg.result.message_id);
				await evtObj.sendCheckinQRCode(user_info, submitRes, opt);
			} else {
				if (serviceMsg.ok)
					await this.#instances.telegram.methods.editMessageText(chat_info.id, serviceMsg.result.message_id, "<b>✅ Submitted end stat!</b>", opt);
				else await this.#instances.telegram.methods.sendMessage(chat_info.id, "<b>✅ Submitted end stat!</b>", opt);
			}
			return;
		});
		return false;
	}

	sheet(chat_info, user_info, callback_info) {
		setImmediate(async () => {
			if (
				callback_info.message_info.reply_to_message?.message_id === undefined ||
				String(callback_info.message_info.reply_to_message?.text || "").length === 0
			) {
				await this.#instances.telegram.methods.editMessageText(
					chat_info.id,
					callback_info.message_info.message_id,
					`<i>Error: What are you submitting?</i>`,
					opt
				);
				return;
			}
			const opt = {
				reply_parameters: {
					message_id: callback_info.message_info.reply_to_message.message_id,
					allow_sending_without_reply: true,
				},
			};
			const events = this.#instances.events.getLeaderEvents(user_info.username);
			const evtObj = events.find((v) => v.id === Number(callback_info.value));
			if (!evtObj) {
				await this.#instances.telegram.methods.editMessageText(chat_info.id, callback_info.message_info.message_id, `<i>Error: Event not found.</i>`, opt);
				return;
			}
			const res = await evtObj.setSheet(String(callback_info.message_info.reply_to_message.text));
			if (res?.ok) this.#instances.events.scheduleSave();
			if (res?.ok) {
				await this.#instances.telegram.methods.editMessageText(
					chat_info.id,
					callback_info.message_info.message_id,
					`<b>✅ Sheet set!</b>\n<i>${evtObj.details.title}</i>`,
					opt
				);
			} else {
				const error =
					res?.error === "SHEET_ACCESS_DENIED"
						? `<i>Error: The bot can't access this sheet. Please share it with the service account.</i>`
						: res?.error === "SHEET_NOT_FOUND"
							? `<i>Error: Sheet not found.</i>`
							: `<b>Failed to set sheet!</b>\nError: ${res?.error || "Internal Error"}`;
				await this.#instances.telegram.methods.editMessageText(chat_info.id, callback_info.message_info.message_id, error, opt);
			}
			return;
		});
		return false;
	}

	passcode(chat_info, user_info, callback_info) {
		setImmediate(async () => {
			if (
				callback_info.message_info.reply_to_message?.message_id === undefined ||
				String(callback_info.message_info.reply_to_message?.text || "").length === 0
			) {
				await this.#instances.telegram.methods.editMessageText(
					chat_info.id,
					callback_info.message_info.message_id,
					`<i>Error: What are you submitting?</i>`,
					opt
				);
				return;
			}
			const opt = {
				reply_parameters: {
					message_id: callback_info.message_info.reply_to_message.message_id,
					allow_sending_without_reply: true,
				},
			};
			const now = new Date();
			const events = this.#instances.events
				.getLeaderEvents(user_info.username)
				.filter(
					(evtObj) =>
						evtObj.details.passcodeStartTime && evtObj.details.passcodeEndTime && evtObj.details.passcodeStartTime < now && now < evtObj.details.passcodeEndTime
				);
			const evtObj = events.find((v) => v.id === Number(callback_info.value));
			if (!evtObj) {
				await this.#instances.telegram.methods.editMessageText(chat_info.id, callback_info.message_info.message_id, `<i>Error: Event not found.</i>`, opt);
				return;
			}
			const passcode = String(callback_info.message_info.reply_to_message.text);
			evtObj.passcode = passcode;
			await this.#instances.telegram.methods.editMessageText(
				chat_info.id,
				callback_info.message_info.message_id,
				`<b>✅ Passcode set</b>: <code>${passcode}</code>`,
				opt
			);
			return;
		});
		return false;
	}

	close(chat_info, _, callback_info) {
		setImmediate(async () => {
			try {
				await this.#instances.telegram.methods.deleteMessages(
					chat_info.id,
					[callback_info.message_info.message_id, callback_info.message_info.reply_to_message?.message_id].filter(Boolean)
				);
			} catch {}
		});
		return false;
	}
}

export default TelegramCallbackqueryHandlers;
