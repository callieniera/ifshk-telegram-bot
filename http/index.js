import HTTPGetHandler from "./get.js";
import HTTPPostHandler from "./post.js";
import HTTPToken from "./token.js";

class HTTPApps {
	constructor(instances) {
		this.#instances = instances;
		this.get = new HTTPGetHandler(instances);
		this.post = new HTTPPostHandler(instances);
		this.token = new HTTPToken();
		return;
	}
	#instances;

	headers = {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "POST, OPTIONS",
		"Access-Control-Max-Age": "300",
	};
}

export default HTTPApps;
