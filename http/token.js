import crypto from "node:crypto";

class HTTPToken {
	/**
	 * Stateless, HMAC-signed JWT-like identity tokens for non-Telegram (HTTP) users.
	 *
	 * HTTP users have no Telegram `user_info`, so on their first submission we mint a
	 * uuid, wrap it in a signed token, and hand it back. On 2nd+ submits the client
	 * echoes the token; we verify it and reuse the uuid as `user_info.id`, which the
	 * sheet layer already matches against column C.
	 *
	 * Token format: `<base64url(header)>.<base64url(payload)>.<base64url(sig)>`
	 *   header  = { alg: "HS256", typ: "JWT" }
	 *   payload = { sub: <uuid>, iat: <ms>, lang: <language_code> }
	 *   sig     = HMAC-SHA256(key, `${header}.${payload}`) where
	 *             key = SHA-256(process.env.TG_BOT_TOKEN)
	 */

	#HEADER = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");

	// Cookie name used to carry the identity token to/from the client.
	#COOKIE_NAME = "ifs_token";

	// Derive a stable HMAC key from the bot token (never store the raw token in the token).
	#key = (() => crypto.createHash("sha256").update(String(process.env.TG_BOT_TOKEN)).digest())();

	#sign(signingInput) {
		return crypto.createHmac("sha256", this.#key).update(signingInput, "utf-8").digest("base64url");
	}

	// Constant-time comparison that tolerates length mismatches (avoids throwing).
	#safeEqual(a, b) {
		const ab = Buffer.from(String(a), "base64url");
		const bb = Buffer.from(String(b), "base64url");
		if (ab.length !== bb.length) return false;
		return crypto.timingSafeEqual(ab, bb);
	}

	/**
	 * Issue a token for a brand-new HTTP user.
	 * @param {string} [languageCode] - Preferred language (e.g. from the Accept-Language header).
	 * @returns {{ token: string, id: string, languageCode: string }}
	 */
	issue(languageCode) {
		const id = crypto.randomUUID();
		const payload = { sub: id, iat: Date.now(), lang: languageCode || "en" };
		const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
		const token = `${this.#HEADER}.${body}.${this.#sign(`${this.#HEADER}.${body}`)}`;
		return { token, id, languageCode: languageCode || "en" };
	}

	/**
	 * Verify a token and return its embedded identity.
	 * @param {string} [token] - The raw token string (Bearer value).
	 * @returns {{ id: string, languageCode: string|undefined } | null} null on any failure.
	 */
	verify(token) {
		if (typeof token !== "string") return null;
		const parts = token.split(".");
		if (parts.length !== 3) return null;
		const [header, body, sig] = parts;
		// Guard against a tampered header: only our own header is accepted.
		if (header !== this.#HEADER) return null;
		if (!this.#safeEqual(sig, this.#sign(`${header}.${body}`))) return null;
		let payload;
		try {
			payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8"));
		} catch {
			return null;
		}
		if (!payload || typeof payload.sub !== "string" || !payload.sub.length) return null;
		return { id: payload.sub, languageCode: payload.lang };
	}

	// Read the identity token from a request's `cookie` header (null if absent).
	readCookie(request) {
		const cookieHeader = request?.headers?.cookie;
		if (!cookieHeader) return null;
		for (const part of String(cookieHeader).split(";")) {
			const eq = part.indexOf("=");
			if (eq === -1) continue;
			const name = part.slice(0, eq).trim();
			if (name !== this.#COOKIE_NAME) continue;
			return decodeURIComponent(part.slice(eq + 1).trim());
		}
		return null;
	}

	// Store the token on the reply as an HttpOnly + Secure cookie.
	// SameSite=None lets a cross-origin web client send the cookie back; switch to
	// "Lax"/"Strict" if the API and the client share the same origin.
	setCookieHeader(reply, token, { sameSite = "None" } = {}) {
		const flags = ["Path=/", "HttpOnly", "Secure", sameSite ? `SameSite=${sameSite}` : ""].filter(Boolean).join("; ");
		reply.header("set-cookie", `${this.#COOKIE_NAME}=${encodeURIComponent(String(token))}; ${flags}`);
		return reply;
	}
}

export default HTTPToken;
