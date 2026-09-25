class HTTPGetHandler {
	constructor(instances) {
		this.#instances = instances;
		this.#instances.server.get("/api/events", this.#Events.bind(this));
		this.#instances.server.get("/api/events/:eventId/status", this.#Status.bind(this));
		return;
	}
	#instances;

	#Events(_, reply) {
		try {
			const events = this.#instances.events.getCurrentEvent();
			// Add the numeric event id (from EventHandlers.id) so web clients can target
			// POST /api/events/:eventId/submit. Purely additive to the details payload.
			reply.headers(this.#instances.http.headers);
			return reply.code(200).send({ ok: true, events: events.map((evt) => ({ ...evt.details, id: evt.id })) });
		} catch (e) {
			console.error(e);
			reply.headers(this.#instances.http.headers);
			return reply.code(500).send({ ok: false, error: e.message || "Internal_Server_Error" });
		}
	}

	// Return the check-in / requirement status for the identity identified by the
	// bearer token: { checkedIn, qualifies, agentName, agentFaction, apGained }. The
	// web client polls this to detect a scan and to show the requirement result.
	async #Status(request, reply) {
		reply.headers(this.#instances.http.headers);
		try {
			const { eventId } = request.params;
			const evtObj = this.#instances.events.getEvent(eventId);
			if (!evtObj) return reply.code(404).send({ ok: false, error: "event_not_found" });

			const rawToken = this.#instances.http.token.readCookie(request);
			const verified = rawToken ? this.#instances.http.token.verify(rawToken) : null;
			if (!verified) return reply.code(401).send({ ok: false, error: "unauthorized" });

			const status = await evtObj.getUserStatus(verified.id);
			return reply.code(200).send({ ok: true, ...status });
		} catch (e) {
			console.error(e);
			return reply.code(500).send({ ok: false, error: e.message || "Internal_Server_Error" });
		}
	}
}
export default HTTPGetHandler;
