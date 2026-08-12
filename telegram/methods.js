import { functions } from "../helpers/index.js";
const parse_mode = "HTML";

class TelegramMethods {
	constructor(token) {
		this.#token = token;
	}
	#token;

	async #telegramAPI(method, data, retry) {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 30 * 1000);

			const response = await fetch(`https://api.telegram.org/bot${this.#token}/${method}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
				signal: controller.signal,
			});
			clearTimeout(timeoutId);
			// Handle server error
			if (!response.ok && response.status >= 500) {
				// Retry server errors
				return await new Promise((resolve) => {
					setTimeout(() => this.#telegramAPI(method, data, (retry || 0) + 1).then(resolve), 10 * 1000);
				});
			}
			const result = await response.json();

			// Handle rate limiting
			if (!result.ok && result.parameters && result.parameters.retry_after) {
				return await new Promise((resolve) => {
					setTimeout(() => this.#telegramAPI(method, data, retry).then(resolve), Number(result.parameters.retry_after) * 1000);
				});
			}

			if (!result.ok && result.description && this.#skipMsg.indexOf(result.description) > -1) return result;
			else if (!result.ok) {
				functions.console(`telegram`, "Method error");
				functions.console(`telegram`, "", `${JSON.stringify({ method, data, result })}`);
			}
			return result;
		} catch (e) {
			if (retry && retry > 10) {
				functions.console(`telegram`, "Error retry 10+ :", e.code || e.name);
				functions.console(`telegram`, "", `${JSON.stringify({ method, data })}`);
				return {};
			}
			if (e instanceof TypeError || e.name === "AbortError") {
				return await new Promise((resolve) => {
					if (e.name === "AbortError") this.#telegramAPI(method, data, (retry || 0) + 1).then(resolve);
					else setTimeout(() => this.#telegramAPI(method, data, (retry || 0) + 1).then(resolve), 15 * 1000);
				});
			}
			functions.console(`telegram`, "Error details:", e.message);
			functions.console(`telegram`, "", `${JSON.stringify({ method, data })}`);
			return {};
		}
	}

	#skipMsg = [
		"Bad Request: message is not modified: specified new message content and reply markup are exactly the same as a current content and reply markup of the message",
		"Bad Request: TOPIC_NOT_MODIFIED",
		"Bad Request: PARTICIPANT_ID_INVALID",
		"Bad Request: chat not found",
		"Bad Request: member not found",
		"Bad Request: message to unpin not found",
		"Bad Request: message can't be deleted for everyone",
	];

	async sendMessage(chat_id, text, additionalOptions) {
		return await this.#telegramAPI("sendMessage", { parse_mode, chat_id, text, ...additionalOptions });
	}
	async sendPhoto(chat_id, text, additionalOptions) {
		return await this.#telegramAPI("sendPhoto", { parse_mode, chat_id, caption: text, ...additionalOptions });
	}
	async sendPhotoFile(chat_id, fileBuffer, filename, additionalOptions) {
		const fields = { chat_id, parse_mode };
		if (additionalOptions) {
			for (const [key, value] of Object.entries(additionalOptions)) {
				if (typeof value === "string" || typeof value === "number") fields[key] = value;
				else if (typeof value === "object") fields[key] = JSON.stringify(value);
			}
		}
		return await this.#telegramAPIMultipart("sendPhoto", fields, "photo", fileBuffer, filename);
	}
	async #telegramAPIMultipart(method, fields, fileField, fileBuffer, filename, retry) {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 120 * 1000);
			const formData = new FormData();
			for (const [key, value] of Object.entries(fields)) formData.append(key, String(value));
			formData.append(fileField, new Blob([fileBuffer], { type: "application/octet-stream" }), filename);
			const response = await fetch(`https://api.telegram.org/bot${this.#token}/${method}`, {
				method: "POST",
				body: formData,
				signal: controller.signal,
			});
			clearTimeout(timeoutId);
			if (!response.ok && response.status >= 500) {
				return await new Promise((resolve) => {
					setTimeout(() => this.#telegramAPIMultipart(method, fields, fileField, fileBuffer, filename, (retry || 0) + 1).then(resolve), 10 * 1000);
				});
			}
			const result = await response.json();
			if (!result.ok && result.parameters && result.parameters.retry_after) {
				return await new Promise((resolve) => {
					setTimeout(
						() => this.#telegramAPIMultipart(method, fields, fileField, fileBuffer, filename, retry).then(resolve),
						Number(result.parameters.retry_after) * 1000
					);
				});
			}
			if (!result.ok && result.description && this.#skipMsg.indexOf(result.description) > -1) return result;
			else if (!result.ok) {
				functions.console(`telegram`, "Method error");
				functions.console(`telegram`, "", `${JSON.stringify({ method, fields, result })}`);
			}
			return result;
		} catch (e) {
			if (retry && retry > 10) {
				functions.console(`telegram`, "Error retry 10+ :", e.code || e.name);
				functions.console(`telegram`, "", `${JSON.stringify({ method, fields })}`);
				return {};
			}
			if (e instanceof TypeError || e.name === "AbortError") {
				return await new Promise((resolve) => {
					if (e.name === "AbortError") this.#telegramAPIMultipart(method, fields, fileField, fileBuffer, filename, (retry || 0) + 1).then(resolve);
					else setTimeout(() => this.#telegramAPIMultipart(method, fields, fileField, fileBuffer, filename, (retry || 0) + 1).then(resolve), 15 * 1000);
				});
			}
			functions.console(`telegram`, "Error details:", e.message);
			functions.console(`telegram`, "", `${JSON.stringify({ method, fields })}`);
			return {};
		}
	}
	async sendLocation(chat_id, location, additionalOptions) {
		const latitude = location.latitude || location.lat,
			longitude = location.longitude || location.lng;
		return await this.#telegramAPI("sendLocation", { parse_mode, chat_id, latitude, longitude, ...additionalOptions });
	}
	async editMessageText(chat_id, message_id, text, additionalOptions) {
		return await this.#telegramAPI("editMessageText", { parse_mode, chat_id, text, message_id, ...additionalOptions });
	}
	async editMessageMedia(chat_id, message_id, additionalOptions) {
		return await this.#telegramAPI("editMessageMedia", { chat_id, message_id, ...additionalOptions });
	}
	async editMessageReplyMarkup(chat_id, message_id, reply_markup) {
		return await this.#telegramAPI("editMessageReplyMarkup", { chat_id, message_id, reply_markup });
	}
	async deleteMessage(chat_id, message_id) {
		return await this.#telegramAPI("deleteMessage", { chat_id, message_id });
	}
	async deleteMessages(chat_id, message_ids) {
		return await this.#telegramAPI("deleteMessages", { chat_id, message_ids });
	}
	async sendDocument(chat_id, document, additionalOptions) {
		return await this.#telegramAPI("sendDocument", { chat_id, document, ...additionalOptions });
	}
	async sendChatAction(chat_id, action, additionalOptions) {
		return await this.#telegramAPI("sendChatAction", { chat_id, action, ...additionalOptions });
	}
	async setMessageReaction(chat_id, message_id, emoji) {
		let reaction = [];
		if (emoji)
			Array.isArray(emoji)
				? emoji.map((e) => {
						reaction.push({ type: "emoji", e });
					})
				: reaction.push({ type: "emoji", emoji });
		return await this.#telegramAPI("setMessageReaction", { chat_id, message_id, reaction });
	}
	async answerCallbackQuery(callback_query_id, text, additionalOptions) {
		return await this.#telegramAPI("answerCallbackQuery", { callback_query_id, text, ...additionalOptions });
	}
	async pinChatMessage(chat_id, message_id) {
		return await this.#telegramAPI("pinChatMessage", { chat_id, message_id });
	}
	async unpinChatMessage(chat_id, message_id) {
		return await this.#telegramAPI("unpinChatMessage", { chat_id, message_id });
	}
	async unpinAllChatMessages(chat_id) {
		return await this.#telegramAPI("unpinChatMessage", { chat_id });
	}
	async unpinAllForumTopicMessages(chat_id, message_thread_id) {
		return await this.#telegramAPI("unpinAllForumTopicMessages", { chat_id, message_thread_id });
	}
	async createForumTopic(chat_id, name) {
		return await this.#telegramAPI("createForumTopic", { chat_id, name });
	}
	async reopenForumTopic(chat_id, message_thread_id) {
		if (message_thread_id) return await this.#telegramAPI("reopenForumTopic", { chat_id, message_thread_id });
		else return await this.#telegramAPI("reopenGeneralForumTopic", { chat_id });
	}
	async closeForumTopic(chat_id, message_thread_id) {
		if (message_thread_id) return await this.#telegramAPI("closeForumTopic", { chat_id, message_thread_id });
		else return await this.#telegramAPI("closeGeneralForumTopic", { chat_id, message_thread_id });
	}
	async deleteForumTopic(chat_id, message_thread_id) {
		return await this.#telegramAPI("deleteForumTopic", { chat_id, message_thread_id });
	}
	async hideGeneralForumTopic(chat_id) {
		return await this.#telegramAPI("hideGeneralForumTopic", { chat_id });
	}
	async unhideGeneralForumTopic(chat_id) {
		return await this.#telegramAPI("unhideGeneralForumTopic", { chat_id });
	}
	async getFile(file_id) {
		let res = await this.#telegramAPI("getFile", { file_id });
		if (res.ok) return `https://api.telegram.org/file/bot${this.#token}/${res.result.file_path}`;
		return null;
	}
	async getChatAdministrators(chat_id) {
		return await this.#telegramAPI("getChatAdministrators", { chat_id });
	}
	async banChatMember(chat_id, user_id) {
		return await this.#telegramAPI("banChatMember", { chat_id, user_id });
	}
	async unbanChatMember(chat_id, user_id) {
		return await this.#telegramAPI("unbanChatMember", { chat_id, user_id, only_if_banned: true });
	}
	async getChat(chat_id) {
		return await this.#telegramAPI("getChat", { chat_id });
	}
	async getChatMember(chat_id, user_id) {
		return await this.#telegramAPI("getChatMember", { chat_id, user_id });
	}
	async createChatInviteLink(chat_id, additionalOptions) {
		return await this.#telegramAPI("createChatInviteLink", { chat_id, creates_join_request: true, ...additionalOptions });
	}
	async revokeChatInviteLink(chat_id, invite_link) {
		return await this.#telegramAPI("revokeChatInviteLink", { chat_id, invite_link });
	}
	async approveChatJoinRequest(chat_id, user_id) {
		return await this.#telegramAPI("approveChatJoinRequest", { chat_id, user_id });
	}
	async declineChatJoinRequest(chat_id, user_id) {
		return await this.#telegramAPI("declineChatJoinRequest", { chat_id, user_id });
	}
	async setChatPermissions(chat_id, permissions, is_forum) {
		if (!permissions) {
			permissions = {
				can_send_messages: true,
				can_send_audios: true,
				can_send_documents: true,
				can_send_photos: true,
				can_send_videos: true,
				can_send_video_notes: true,
				can_send_voice_notes: true,
				can_send_polls: true,
				can_send_other_messages: true,
				can_add_web_page_previews: true,
				can_change_info: false,
				can_invite_users: false,
				can_pin_messages: false,
			};
		}
		if (is_forum && !permissions.can_manage_topics) {
			permissions.can_manage_topics = false;
		}
		return await this.#telegramAPI("setChatPermissions", { chat_id, permissions });
	}
	async promoteChatMember(chat_id, user_id, permissions) {
		if (permissions.is_anonymous) permissions.is_anonymous = false;
		return await this.#telegramAPI("promoteChatMember", { chat_id, user_id, ...permissions });
	}
	async leaveChat(chat_id) {
		return await this.#telegramAPI("leaveChat", { chat_id });
	}
	async getMe() {
		return await this.#telegramAPI("getMe");
	}
	async getWebhookInfo() {
		return await this.#telegramAPI("getWebhookInfo", {});
	}
	async setWebhook(url, secret_token, allowed_updates) {
		return await this.#telegramAPI("setWebhook", {
			url,
			max_connections: 100,
			drop_pending_updates: false,
			allowed_updates: allowed_updates,
			secret_token,
		});
	}
	async deleteWebhook() {
		return await this.#telegramAPI("deleteWebhook");
	}
	async getMyDefaultAdministratorRights() {
		return await this.#telegramAPI("getMyDefaultAdministratorRights");
	}
	async setMyDefaultAdministratorRights() {
		let rights = {
			can_manage_chat: true,
			can_change_info: false,
			can_delete_messages: true,
			can_invite_users: false,
			can_restrict_members: false,
			can_pin_messages: false,
			can_promote_members: false,
			can_manage_video_chat: false,
			can_post_stories: false,
			can_edit_stories: false,
			can_delete_stories: false,
			can_manage_voice_chats: false,
			is_anonymous: false,
		};
		return await this.#telegramAPI("setMyDefaultAdministratorRights", { rights });
	}
	async setMyCommands(commands, scope, language_code) {
		return await this.#telegramAPI("setMyCommands", { commands, scope, language_code });
	}
	async deleteMyCommands(scope, language_code) {
		return await this.#telegramAPI("deleteMyCommands", { scope, language_code });
	}
	async deleteMyAllCommands() {
		let scopes = ["default", "all_private_chats", "all_group_chats", "all_chat_administrators"];
		let language_code = ["ja", "zh", undefined];
		let promises = [];
		scopes.map((scope) => {
			language_code.map((language_code) => {
				promises.push(this.#telegramAPI("deleteMyCommands", { scope: { type: scope }, language_code }));
			});
		});
		await Promise.all(promises);
		return { ok: true };
	}
	async setMyName(name) {
		return await this.#telegramAPI("setMyName", { name });
	}
}

export default TelegramMethods;
