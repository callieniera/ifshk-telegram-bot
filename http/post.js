class HTTPPostHandler {
	constructor(instances) {
		this.#instances = instances;
		this.#instances.server.post("/api/events/:eventId/submit", this.#Submit.bind(this));
		return;
	}
	#instances;

	async #Submit(request, reply) {
		try {
			const { eventId } = request.params;
			const evtObj = this.#instances.events.getEvent(eventId);
			if (!evtObj) return reply.code(404).send({ ok: false, error: "event_not_found" });

			const i18n = this.#instances.i18n;
			const stat = request.body?.stat;
			if (typeof stat !== "string" || !stat.trim().length) return reply.code(400).send({ ok: false, error: "stat_required" });

			// Resolve the submitting identity from the token cookie.
			const rawToken = this.#instances.http.token.readCookie(request);
			let user_info;
			if (rawToken) {
				const verified = this.#instances.http.token.verify(rawToken);
				if (!verified) return reply.code(401).send({ ok: false, error: "unauthorized" });
				user_info = { id: verified.id, language_code: verified.languageCode };
			} else {
				// First submission: no token cookie yet — mint a uuid token for the caller and
				// hand it back as an HttpOnly + Secure cookie.
				const languageCode = this.#firstLanguage(request.headers);
				const issued = this.#instances.http.token.issue(languageCode);
				user_info = { id: issued.id, language_code: issued.languageCode };
				this.#instances.http.token.setCookieHeader(reply, issued.token);
			}

			const res = await evtObj.submit(String(stat), user_info);

			// Success: submit() returns an object.  Failure: it returns a string / undefined.
			if (res && typeof res === "object") {
				return reply.code(200).send({ ok: true, result: res });
			}

			const error = typeof res === "string" ? res : i18n.t(user_info, "error.submit_internal");
			return reply.code(400).send({ ok: false, error });
		} catch (err) {
			console.error(err);
			return reply.code(500).send({ ok: false, error: err.message || "Internal_Server_Error" });
		}
	}

	// Pull the first Accept-Language tag to seed the new user's language_code.
	#firstLanguage(headers) {
		const raw = headers?.["accept-language"];
		if (!raw) return undefined;
		const first = String(raw).split(",")[0].trim();
		return first || undefined;
	}
}

export default HTTPPostHandler;
