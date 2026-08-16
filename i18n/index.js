import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { functions } from "../helpers/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const _localesDir = join(__dirname, "locales");
const _defaultLocale = "en";

// Map a raw Telegram `language_code` (or any BCP-47-ish tag) to a catalog key.
// - en / en-*  -> "en"
// - zh-CN / zh-Hans -> "zh-CN"  (Simplified)
// - zh-TW / zh-HK / zh-Hant / bare "zh" -> "zh-HK" (Traditional, per user)
const _localeMap = {
	en: "en",
	"zh-CN": "zh-CN",
	"zh-Hans": "zh-CN",
	"zh-TW": "zh-HK",
	"zh-HK": "zh-HK",
	"zh-Hant": "zh-HK",
	zh: "zh-HK",
};

class I18n {
	#catalog = {};
	#default = _defaultLocale;

	constructor() {
		if (!existsSync(_localesDir)) {
			functions.console("appstart", "i18n", "locales directory not found");
			return;
		}
		for (const file of readdirSync(_localesDir)) {
			if (!file.endsWith(".json")) continue;
			const locale = file.slice(0, -5);
			try {
				this.#catalog[locale] = JSON.parse(readFileSync(join(_localesDir, file), "utf8"));
			} catch (e) {
				functions.console("appstart", "i18n", `Failed to load locale "${locale}": ${e.message || e}`);
			}
		}
		// Guarantee the default locale exists.
		if (!this.#catalog[this.#default]) this.#catalog[this.#default] = {};
		return;
	}

	// Normalize a raw language_code / user_info to a catalog locale key.
	resolveLocale(languageCode) {
		if (!languageCode) return this.#default;
		const raw = String(languageCode).trim();
		// Exact match first (e.g. "zh-HK").
		if (_localeMap[raw] !== undefined) return _localeMap[raw];
		// Prefix match for "en-US", "en-GB", "zh-CN" style tags.
		const prefix = raw.split("-")[0].toLowerCase();
		if (prefix === "en") return "en";
		if (prefix === "zh") return this.#default; // bare / unknown zh -> default catalog
		return this.#default;
	}

	// Deep-lookup a dotted/nested key (e.g. "error.event_not_found").
	#lookup(tree, key) {
		if (!tree) return undefined;
		if (Object.prototype.hasOwnProperty.call(tree, key)) return tree[key];
		const segments = key.split(".");
		let node = tree;
		for (const seg of segments) {
			if (node === null || node === undefined || typeof node !== "object") return undefined;
			node = node[seg];
		}
		return node === undefined ? undefined : node;
	}

	// Interpolate {{var}} placeholders; fall back to English value, then the key itself.
	translate(locale, key, vars = {}) {
		const tree = this.#catalog[locale] || {};
		let value = this.#lookup(tree, key);
		if (value === undefined) value = this.#lookup(this.#catalog[this.#default], key);
		if (value === undefined) {
			functions.console("i18n", "Missing key", `${key} [${locale}]`);
			return key;
		}
		if (typeof value !== "string") return String(value);
		return value.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, name) => (name in vars ? vars[name] : match));
	}

	// Convenience for handlers: resolve locale from user_info.language_code, then translate.
	t(user_info, key, vars = {}) {
		return this.translate(this.resolveLocale(user_info?.language_code), key, vars);
	}

	// Format a date/time for a locale with options (timeZone, dateStyle, timeStyle...).
	// Falls back to "en-HK" for locales the runtime lacks ICU data for.
	formatDate(date, locale, options = {}) {
		const normalized = this.resolveLocale(locale) === "en" ? "en-HK" : locale;
		try {
			return new Intl.DateTimeFormat(normalized, options).format(date);
		} catch {
			return new Intl.DateTimeFormat("en-HK", options).format(date);
		}
	}
}

export default I18n;
