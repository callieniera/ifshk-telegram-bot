class TelegramUtils {
	constructor(ins) {
		this.#instances = ins;
		if (process.env.GLOBAL_ADMIN_IDS) this.#globalAdmin = new Set(JSON.parse(process.env.GLOBAL_ADMIN_IDS));
	}
	#instances;

	#globalAdmin = new Set();
	isGlobalAdmin(user_info) {
		return this.#globalAdmin.has(user_info.id);
	}

	chat_info(json) {
		const t = "type";
		json[t] = "other";
		if (json.callback_query) {
			json[t] = "callback_query";
			return json;
		}
		if (json.message && json.message.text) {
			if (json.message.entities && json.message.entities[0].type === "bot_command") {
				json[t] = "command";
				return json;
			} else {
				json[t] = "message";
				return json;
			}
		}
		return json;
	}

	chatTextType(string) {
		const matches = String(string).match(/\r?\n/g);
		if (matches && matches.length === 1 && string.indexOf("Time Span") === 0) return "stat";
		if (String(string).includes("docs.google.com/spreadsheets")) return "sheet";
		return "other";
	}
}

export default TelegramUtils;
