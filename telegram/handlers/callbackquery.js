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
			const i18n = this.#instances.i18n;
			if (
				callback_info.message_info.reply_to_message?.message_id === undefined ||
				String(callback_info.message_info.reply_to_message?.text || "").length === 0
			) {
				await this.#instances.telegram.methods.editMessageText(
					chat_info.id,
					callback_info.message_info.message_id,
					i18n.t(user_info, "error.what_submitting"),
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
				await this.#instances.telegram.methods.editMessageText(
					chat_info.id,
					callback_info.message_info.message_id,
					i18n.t(user_info, "error.event_not_found"),
					opt
				);
				return;
			}
			evtObj.noteMessage(chat_info.id, callback_info.message_info.message_id);
			const serviceMsg = await this.#instances.telegram.methods.editMessageText(
				chat_info.id,
				callback_info.message_info.message_id,
				i18n.t(user_info, "success.submitting"),
				opt
			);
			const submitRes = await evtObj.submit(String(callback_info.message_info.reply_to_message.text), user_info);
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
		});
		return false;
	}

	sheet(chat_info, user_info, callback_info) {
		setImmediate(async () => {
			const i18n = this.#instances.i18n;
			if (
				callback_info.message_info.reply_to_message?.message_id === undefined ||
				String(callback_info.message_info.reply_to_message?.text || "").length === 0
			) {
				await this.#instances.telegram.methods.editMessageText(
					chat_info.id,
					callback_info.message_info.message_id,
					i18n.t(user_info, "error.what_submitting"),
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
				await this.#instances.telegram.methods.editMessageText(
					chat_info.id,
					callback_info.message_info.message_id,
					i18n.t(user_info, "error.event_not_found"),
					opt
				);
				return;
			}
			evtObj.noteMessage(chat_info.id, callback_info.message_info.message_id);
			const res = await evtObj.setSheet(String(callback_info.message_info.reply_to_message.text));
			if (res?.ok) this.#instances.events.scheduleSave();
			if (res?.ok) {
				await this.#instances.telegram.methods.editMessageText(
					chat_info.id,
					callback_info.message_info.message_id,
					i18n.t(user_info, "success.sheet_set", { title: evtObj.details.title }),
					opt
				);
			} else {
				const error =
					res?.error === "SHEET_ACCESS_DENIED"
						? i18n.t(user_info, "error.sq_access")
						: res?.error === "SHEET_NOT_FOUND"
							? i18n.t(user_info, "error.sq_notfound")
							: i18n.t(user_info, "error.sq_generic", { error: res?.error || i18n.t(user_info, "error.submit_internal") });
				await this.#instances.telegram.methods.editMessageText(chat_info.id, callback_info.message_info.message_id, error, opt);
			}
			return;
		});
		return false;
	}

	passcode(chat_info, user_info, callback_info) {
		setImmediate(async () => {
			const i18n = this.#instances.i18n;
			if (
				callback_info.message_info.reply_to_message?.message_id === undefined ||
				String(callback_info.message_info.reply_to_message?.text || "").length === 0
			) {
				await this.#instances.telegram.methods.editMessageText(
					chat_info.id,
					callback_info.message_info.message_id,
					i18n.t(user_info, "error.what_submitting"),
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
				await this.#instances.telegram.methods.editMessageText(
					chat_info.id,
					callback_info.message_info.message_id,
					i18n.t(user_info, "error.event_not_found"),
					opt
				);
				return;
			}
			evtObj.noteMessage(chat_info.id, callback_info.message_info.message_id);
			const passcode = String(callback_info.message_info.reply_to_message.text);
			evtObj.passcode = passcode;
			await this.#instances.telegram.methods.editMessageText(
				chat_info.id,
				callback_info.message_info.message_id,
				i18n.t(user_info, "success.passcode_set", { passcode })
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
