import { JSDOM } from "jsdom";
import * as nodeCanvas from "canvas";
import QRCodeStyling from "qr-code-styling";

class TelegramUtils {
	constructor(ins) {
		this.#instances = ins;
	}
	#instances;

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

	#sentCheckinQrCode = new Map();

	getSentCheckinQrCode(agentName) {
		return this.#sentCheckinQrCode.get(agentName) || null;
	}

	async sendCheckinQRCode(user_info, agentName, id, opt) {
		try {
			const options = {
				width: 1080,
				height: 1080,
				data: `https://t.me/${process.env.TG_BOT_USERNAME}?start=checkin-${id}-${agentName}`,
				dotsOptions: {
					color: "#7f58ae",
					type: "extra-rounded",
				},
				backgroundOptions: {
					color: "#000000",
				},
				imageOptions: {
					saveAsBlob: true,
					crossOrigin: "anonymous",
					margin: 10,
					imageSize: 0.6,
				},
				margin: 54,
			};
			const qrCodeImage = new QRCodeStyling({
				jsdom: JSDOM, // this is required
				nodeCanvas, // this is required,
				...options,
			});
			const file = qrCodeImage.getRawData("png");
			const message_options = {
				...opt,
				show_caption_above_media: true,
				protect_content: true,
			};
			await this.#instances.telegram.methods.sendChatAction(user_info.id, "upload_photo");
			const tg_res = await this.#instances.telegram.methods.sendPhotoFile(user_info.id, await file, "qrcode.png", message_options);
			if (tg_res.ok) this.#sentCheckinQrCode.set(agentName, { id: user_info.id, message_id: tg_res.result.message_id });
		} catch (err) {
			console.error(err);
			const tg_res = await this.#instances.telegram.methods.sendMessage(user_info.id, "<i>Error: Unable to generate QR Code for check-in.</i>", opt);
			if (tg_res.ok) this.#sentCheckinQrCode.set(agentName, { id: user_info.id, message_id: tg_res.result.message_id });
		}
	}
}

export default TelegramUtils;
