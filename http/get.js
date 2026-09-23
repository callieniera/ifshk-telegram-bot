class HTTPGetHandler {
	constructor(instances) {
		this.#instances = instances;
		this.#instances.server.get("/api/events", this.#Events.bind(this));
		this.#instances.server.get("/api/events/:eventId/passcode", this.#Passcode.bind(this));
		return;
	}
	#instances;

	#Events(_, reply) {
		try {
			const events = this.#instances.events.getCurrentEvent();
			return reply.code(200).send({ ok: true, events: events.map((evt) => evt.details) });
		} catch (e) {
			console.error(e);
			return reply.code(500).send({ ok: false, error: e.message || "Internal_Server_Error" });
		}
	}

	// Return the event passcode for the identity identified by the bearer token,
	// only when that identity's sheet row qualifies for the passcode.
	async #Passcode(request, reply) {
		try {
			const { eventId } = request.params;
			const evtObj = this.#instances.events.getEvent(eventId);
			if (!evtObj) return reply.code(404).send({ ok: false, error: "event_not_found" });

			const auth = request.headers?.authorization;
			const rawToken = auth && auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
			const verified = rawToken ? this.#instances.http.token.verify(rawToken) : null;
			if (!verified) return reply.code(401).send({ ok: false, error: "unauthorized" });

			const passcode = await evtObj.getPasscodeById(verified.id);
			if (passcode) return reply.code(200).send({ ok: true, passcode });
			return reply.code(404).send({ ok: false, error: "not_qualified" });
		} catch (e) {
			console.error(e);
			return reply.code(500).send({ ok: false, error: e.message || "Internal_Server_Error" });
		}
	}
}

export default HTTPGetHandler;
