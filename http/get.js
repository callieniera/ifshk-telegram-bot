class HTTPGetHandler {
	constructor(instances) {
		this.#instances = instances;
		this.#instances.server.get("/api/events", this.#Events.bind(this));
		this.#instances.server.get("/api/events/:eventId/passcode", this.#Passcode.bind(this));
		this.#instances.server.get("/api/events/:eventId/status", this.#Status.bind(this));
		this.#instances.server.get("/api/events/:eventId/qrcode", this.#Qrcode.bind(this));
		return;
	}
	#instances;

	#Events(_, reply) {
		try {
			const events = this.#instances.events.getCurrentEvent();
			// Add the numeric event id (from EventHandlers.id) so web clients can target
			// POST /api/events/:eventId/submit. Purely additive to the details payload.
			return reply.code(200).send({ ok: true, events: events.map((evt) => ({ ...evt.details, id: evt.id })) });
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

			// Verify the identity token carried in the request cookie.
			const rawToken = this.#instances.http.token.readCookie(request);
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
	// Return the check-in / requirement status for the identity identified by the
	// bearer token: { checkedIn, qualifies, agentName, agentFaction, apGained }. The
	// web client polls this to detect a scan and to show the requirement result.
	async #Status(request, reply) {
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

	// Return the check-in QR (data:image/png;base64) for the identity's own agent, so
	// the web client can display it. The agent may be passed via query params
	// (`agentName`/`agentFaction`, used right after a new-agent submit before the
	// sheet row is written) or resolved from the identity's sheet row. Returns
	// { ok: true, qrcode } or 400 { ok: false, error: "no_agent" }.
	async #Qrcode(request, reply) {
		try {
			const { eventId } = request.params;
			const evtObj = this.#instances.events.getEvent(eventId);
			if (!evtObj) return reply.code(404).send({ ok: false, error: "event_not_found" });

			const rawToken = this.#instances.http.token.readCookie(request);
			const verified = rawToken ? this.#instances.http.token.verify(rawToken) : null;
			if (!verified) return reply.code(401).send({ ok: false, error: "unauthorized" });

			// Prefer the agent identity passed in the request (immediate after a new-agent
			// submit, before the sheet row is written); otherwise resolve it from the
			// identity's sheet row.
			const agentName =
				typeof request.query?.agentName === "string" && request.query.agentName.trim().length
					? request.query.agentName.trim()
					: (await evtObj.getUserStatus(verified.id)).agentName;
			if (!agentName) return reply.code(400).send({ ok: false, error: "no_agent" });
			const agentFaction = typeof request.query?.agentFaction === "string" ? request.query.agentFaction : "unknown";
			const qrcode = await evtObj.getCheckinQrDataUrl(agentName, agentFaction);
			return reply.code(200).send({ ok: true, qrcode });
		} catch (e) {
			console.error(e);
			return reply.code(500).send({ ok: false, error: e.message || "Internal_Server_Error" });
		}
	}
}
export default HTTPGetHandler;
