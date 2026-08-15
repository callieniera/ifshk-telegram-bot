import Fastify from "fastify";
import dotenv from "dotenv";
dotenv.config({ quiet: true });
import { classes, functions } from "./helpers/index.js";
import TelegramApp from "./telegram/index.js";
import EventApp from "./events/index.js";
import i18n from "./i18n/index.js";

const { GoogleServiceAccountAuth } = classes;

class App {
	constructor() {
		const requiredEnv = ["PORT", "TG_BOT_TOKEN", "SERVERURL", "GOOGLE_SERVICE_ACCOUNT_JSON"];
		for (const key of requiredEnv) {
			if (!process.env[key]) throw ReferenceError(`Missing critical environment variable: ${key}`);
		}
		this.port = process.env.PORT;
		this.url = process.env.SERVERURL;
		this.server = Fastify();
		this.init();

		process.on("SIGINT", this.#onclose.bind(this));
		process.on("SIGTERM", this.#onclose.bind(this));
		process.on("SIGQUIT", this.#onclose.bind(this));
		return;
	}

	#onclosefn = [];

	async init() {
		const instances = { server: this.server, onclose: this.#onclosefn };
		instances.google = new GoogleServiceAccountAuth();
		instances.onclose.push(() => instances.google.clearCachedToken());
		const events = new EventApp(instances);
		instances.events = events;
		await events.initSync();
		instances.i18n = new i18n();
		const telegram = new TelegramApp(instances, {
			url: this.url,
			token: process.env.TG_BOT_TOKEN,
			endpoint: "telegram",
			allowed_updates: ["message", "callback_query"],
		});
		await telegram.initedSync();
		instances.telegram = telegram;
		await this.server.listen({ port: Number(this.port), host: "0.0.0.0" });
		functions.console("appstart", "Entities App Listening on Port:", this.port);
		return;
	}

	async #onclose() {
		if (this.#onclosefn.length) await Promise.all(this.#onclosefn.map(async (fn) => await fn()));
		functions.console("appstart", "process exit.", "");
		process.exit();
	}
}

export default new App();
