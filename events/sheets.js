/**
 * Thin Google Sheets API v4 helper layer.
 * All functions accept a bearer token obtained from GoogleServiceAccountAuth.
 */

const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

/**
 * Make a Sheets API request, retrying on 429 and 5xx with bounded exponential backoff.
 * @param {string} method
 * @param {string} url
 * @param {string} token  - Bearer access token
 * @param {*}      [body] - Request body (will be JSON-serialised)
 * @param {number} [attempt=0]
 */
async function sheetsRequest(method, url, token, body, attempt = 0) {
	const opts = {
		method,
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
	};
	if (body !== undefined) opts.body = JSON.stringify(body);

	const res = await fetch(url, opts);
	const data = await res.json();

	if (!res.ok) {
		const status = res.status;
		// Retry transient failures (rate-limit / server errors)
		if ((status === 429 || status >= 500) && attempt < 3) {
			const delay = Math.min(500 * Math.pow(2, attempt), 8000);
			await new Promise((r) => setTimeout(r, delay));
			return sheetsRequest(method, url, token, body, attempt + 1);
		}
		const msg = data?.error?.message || `HTTP ${status}`;
		const err = new Error(`Sheets API: ${msg}`);
		err.status = status;
		err.sheetsError = data?.error;
		throw err;
	}

	return data;
}

/**
 * Verify access and resolve a numeric sheetId (gid) to its tab title.
 * @param {string}        token
 * @param {string}        sid   - Spreadsheet ID
 * @param {string|number} gid   - Numeric sheet tab ID
 * @returns {{ title: string, index: number, spreadsheetName: string } | null}
 *   null when the gid is not found in the spreadsheet.
 */
async function resolveTab(token, sid, gid) {
	const url = `${SHEETS_BASE}/${encodeURIComponent(sid)}?fields=properties.title,sheets.properties`;
	const data = await sheetsRequest("GET", url, token);
	const sheets = data.sheets || [];
	const numericGid = Number(gid);
	const found = sheets.find((s) => s.properties && s.properties.sheetId === numericGid);
	if (!found) return null;
	return { title: found.properties.title, index: found.properties.index, spreadsheetName: data.properties?.title || "" };
}

/**
 * Read values from a sheet range.
 * @param {string} token
 * @param {string} sid
 * @param {string} range - A1 notation (e.g. "'Sheet1'!A:A")
 * @returns {Array<Array<string>>} 2-D array; empty array if the range has no data.
 */
async function getRange(token, sid, range) {
	const url = `${SHEETS_BASE}/${encodeURIComponent(sid)}/values/${encodeURIComponent(range)}`;
	const data = await sheetsRequest("GET", url, token);
	return data.values || [];
}

/**
 * Overwrite a range with new values (RAW input).
 * @param {string}          token
 * @param {string}          sid
 * @param {string}          range  - A1 notation
 * @param {Array<Array<*>>} values - 2-D array of values
 */
async function updateRange(token, sid, range, values) {
	const url = `${SHEETS_BASE}/${encodeURIComponent(sid)}/values/${encodeURIComponent(range)}?valueInputOption=RAW`;
	return sheetsRequest("PUT", url, token, { range, values });
}

/**
 * Append rows after the last row with data in the table (RAW input).
 * @param {string}          token
 * @param {string}          sid
 * @param {string}          sheetTitle - Bare sheet tab name (not A1-quoted)
 * @param {Array<Array<*>>} values     - 2-D array; each inner array is one row
 */
async function appendRows(token, sid, sheetTitle, values) {
	// Single-quote the sheet title to handle spaces/special chars
	const safeTitle = sheetTitle.replace(/'/g, "\\'");
	const range = `'${safeTitle}'!A1`;
	const url = `${SHEETS_BASE}/${encodeURIComponent(sid)}/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
	return sheetsRequest("POST", url, token, { range, values });
}

function indexToA1(col) {
	let colStr = "";
	let n = col + 1; // Convert 0-indexed to 1-indexed for the algorithm
	while (n > 0) {
		let remainder = (n - 1) % 26;
		colStr = String.fromCharCode(65 + remainder) + colStr;
		n = Math.floor((n - remainder) / 26);
	}
	return colStr;
}

export { resolveTab, getRange, updateRange, appendRows, indexToA1 };
