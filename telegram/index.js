import { functions } from "../helpers/index.js";
import TelegramMethods from "./methods.js";
import TelegramUtils from "./utils.js";
import TelegramHandlers from "./handlers/index.js";

class TelegramApp {
	constructor(instances, options) {
		this.#instances = instances;
		this.methods = new TelegramMethods(options.token);
		this.utils = new TelegramUtils(this.#instances);
		this.#init(`${options.url}`, `${options.endpoint}`, options.allowed_updates);
		return;
	}

	#instances;
	methods;
	utils;

	#inited = [];
	async initedSync() {
		if (typeof this.#inited === "boolean") return this.#inited;
		return await new Promise((resolve) => this.#inited.push(resolve));
	}

	async #init(url, endpoint, allowed_updates = ["message"]) {
		this.handlers = new TelegramHandlers(this.#instances);
		this.#instances.server.post(`/${endpoint}`, this.#Listener.bind(this));
		await this.methods.deleteWebhook();
		this.#secret_token = functions.rand.token();
		const tg_res = await this.methods.getMe();
		if (!tg_res || !tg_res.ok || !tg_res.result) {
			functions.console("appstart", "Telegram getMe failed:", JSON.stringify(tg_res || {}));
			return;
		}
		this.BOT_USERNAME = tg_res.result.username;
		process.env.TG_BOT_USERNAME = this.BOT_USERNAME;
		this.BOT_USERID = tg_res.result.id;
		process.env.TG_BOT_USERID = this.BOT_USERID;
		const setup = await this.methods.setWebhook(`${url}/${endpoint}`, this.#secret_token, allowed_updates);
		if (setup.ok) {
			functions.console("appstart", "Webhook url:");
			functions.console("appstart", "", `${url}/${endpoint}`);
			functions.console("appstart", `Telegram response:`, setup.description);
			this.methods.setMyDefaultAdministratorRights();
			this.methods.deleteMyAllCommands();
			if (process.env.BOT_NAME_FOR_TEST) {
				if (tg_res.ok && tg_res.result.first_name != process.env.BOT_NAME_FOR_TEST) {
					this.methods.setMyName(process.env.BOT_NAME_FOR_TEST);
				}
			}
			if (typeof this.#inited === "object" && this.#inited.length) this.#inited.map((fn) => fn(true));
			this.#inited = true;
		} else {
			functions.console("appstart", `Telegram:`);
			functions.console("appstart", ``, JSON.stringify(setup));
		}
		return;
	}

	#secret_token;
	async #Listener(request, reply) {
		if (!request.headers || !request.headers["x-telegram-bot-api-secret-token"] || request.headers["x-telegram-bot-api-secret-token"] !== this.#secret_token)
			return reply.code(200).send();
		const json = this.utils.chat_info(request.body);
		if (!this.handlers[json.type]) return reply.code(200).send();
		const result = await this.handlers[json.type](json);
		if (!result) return reply.code(200).send();
		reply.code(200).send(result);
		return;
	}
}

export default TelegramApp;
