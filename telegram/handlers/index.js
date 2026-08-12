import TelegramCommandHandlers from "./command.js";
import TelegramCallbackqueryHandlers from "./callbackquery.js";
import TelegramMessagesHandlers from "./messages.js";

class RepeatCheck {
	#storage = new Map();

	isRepeat(chat_id, message_id) {
		if (!this.#storage.has(chat_id)) this.#storage.set(chat_id, new Map());
		const chatObj = this.#storage.get(chat_id);
		if (chatObj.has(message_id)) return true;
		let timeout = setTimeout(() => {
			if (chatObj.has(message_id)) chatObj.delete(message_id);
			if (!chatObj.size) this.#storage.delete(chat_id);
		}, 1000);
		chatObj.set(message_id, timeout);
		return false;
	}
}

const repeatcheck = new RepeatCheck();

class TelegramHandlers {
	constructor(instances) {
		this.#instances = instances;
		this.#CommandHandlers = new TelegramCommandHandlers(this.#instances);
		this.#CallbackqueryHandlers = new TelegramCallbackqueryHandlers(this.#instances);
		this.#MessageHandlers = new TelegramMessagesHandlers(this.#instances);
		return;
	}
	#instances;

	#CommandHandlers;
	async command(json) {
		const fullcommand = json.message.text.slice(1, json.message.entities[0].length).toLowerCase();
		const [command, toBot] = fullcommand.split("@");
		if (toBot && toBot != process.env.BOT_USERNAME.toLowerCase()) {
			return false;
		}
		const chat_info = {
			...json.message.chat,
		};
		if (json.message.is_topic_message) chat_info.message_thread_id = json.message.message_thread_id;
		const user_info = {
			...json.message.from,
		};
		const message_info = {
			message_id: json.message.message_id,
			content: json.message.text.slice(json.message.entities[0].length + 1),
			reply_to_message: json.message.reply_to_message,
			entities: json.message.entities,
		};
		if (repeatcheck.isRepeat(chat_info.id, message_info.message_id)) return false;
		let c;
		for (let module in this.#instances) {
			if (this.#instances[module] && this.#instances[module].commands && this.#instances[module].commands[command]) {
				c = this.#instances[module].commands[command].bind(this.#instances[module].commands);
				break;
			}
		}
		if (!c && !this.#CommandHandlers[command]) return false;
		else if (!c) c = this.#CommandHandlers[command].bind(this.#CommandHandlers);
		return await c(chat_info, user_info, message_info);
	}

	#CallbackqueryHandlers;
	#allowNoValueCallback = [];
	async callback_query(json) {
		const chat_info = {
			...json.callback_query.message.chat,
		};
		if (json.callback_query.message.is_topic_message) chat_info.message_thread_id = json.callback_query.message.message_thread_id;
		const user_info = {
			...json.callback_query.from,
		};
		const [command, value] = json.callback_query.data.split("_");

		if (!value && this.#allowNoValueCallback.indexOf(command) === -1) return false;
		const callback_info = {
			id: json.callback_query.id,
			message_info: { ...json.callback_query.message },
			value,
		};
		let cq;
		for (let module in this.#instances) {
			if (this.#instances[module] && this.#instances[module].callbackqueries && this.#instances[module].callbackqueries[command]) {
				cq = this.#instances[module].callbackqueries[command].bind(this.#instances[module].callbackqueries);
				break;
			}
		}
		let result;
		switch (!cq) {
			case true:
				if (!this.#CallbackqueryHandlers[command]) break;
				cq = this.#CallbackqueryHandlers[command].bind(this.#CallbackqueryHandlers);
			case false:
				result = await cq(chat_info, user_info, callback_info, json);
		}
		if (result === false)
			return {
				method: "answerCallbackQuery",
				callback_query_id: json.callback_query.id,
			};
		else if (result === null) return false;
		return result;
	}

	#MessageHandlers;
	async message(json) {
		const chat_info = {
			...json.message.chat,
		};
		if (json.message.is_topic_message) chat_info.message_thread_id = json.message.message_thread_id;
		const user_info = {
			...json.message.from,
		};
		const message_info = {
			message_id: json.message.message_id,
			content: json.message.text,
			reply_to_message: json.message.reply_to_message,
			entities: json.message.entities,
		};
		if (repeatcheck.isRepeat(chat_info.id, message_info.message_id)) return false;
		const messageType = this.#instances.telegram.utils.chatTextType(message_info.content);
		if (typeof this.#MessageHandlers[messageType] === "function") return await this.#MessageHandlers[messageType](chat_info, user_info, message_info);
		return false;
	}

	default() {
		return false;
	}
}

export default TelegramHandlers;
