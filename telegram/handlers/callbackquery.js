import { functions } from "../../helpers/index.js";

class TelegramCallbackqueryHandlers {
	constructor(instances) {
		this.#instances = instances;
		return;
	}
	#instances;

	#cachedQuery = new Set();

}

export default TelegramCallbackqueryHandlers;
