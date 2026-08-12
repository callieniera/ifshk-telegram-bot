class GoogleServiceAccountAuth {
	#accessToken;
	#accessTokenExpiresAt = 0;
	#accessTokenPromise;

	#SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

	async getServiceAccountToken() {
		const nowMs = Date.now();
		if (this.#accessToken && this.#accessTokenExpiresAt - 60 * 1000 > nowMs) return this.#accessToken;
		if (this.#accessTokenPromise) return await this.#accessTokenPromise;

		this.#accessTokenPromise = (async () => {
			const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
			if (!saJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
			const sa = JSON.parse(saJson);
			if (!sa.client_email || !sa.private_key) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is missing client_email/private_key");

			const now = Math.floor(Date.now() / 1000);
			const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
			const payload = Buffer.from(
				JSON.stringify({
					iss: sa.client_email,
					scope: this.#SHEETS_SCOPE,
					aud: "https://oauth2.googleapis.com/token",
					iat: now,
					exp: now + 3600,
				})
			).toString("base64url");
			const signingInput = `${header}.${payload}`;

			const pemBody = sa.private_key.replace(/-----[^\n]+-----/g, "").replace(/\s+/g, "");
			const keyDer = Buffer.from(pemBody, "base64");
			const webcrypto = globalThis.crypto?.subtle ? globalThis.crypto : require("node:crypto").webcrypto;
			const cryptoKey = await webcrypto.subtle.importKey("pkcs8", keyDer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
			const signature = await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, Buffer.from(signingInput));
			const jwt = `${signingInput}.${Buffer.from(signature).toString("base64url")}`;

			const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
					assertion: jwt,
				}),
			});
			const tokenJson = await tokenRes.json();
			if (!tokenJson.access_token) throw new Error(`Google OAuth error: ${tokenJson.error_description || tokenJson.error}`);

			this.#accessToken = tokenJson.access_token;
			const expiresInSec = Number(tokenJson.expires_in);
			this.#accessTokenExpiresAt = Date.now() + (Number.isFinite(expiresInSec) && expiresInSec > 0 ? expiresInSec : 3600) * 1000;
			return this.#accessToken;
		})();

		try {
			return await this.#accessTokenPromise;
		} finally {
			this.#accessTokenPromise = undefined;
		}
	}

	clearCachedToken() {
		this.#accessToken = undefined;
		this.#accessTokenExpiresAt = 0;
		this.#accessTokenPromise = undefined;
	}
}

export default GoogleServiceAccountAuth;