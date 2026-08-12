import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const _dbDir = resolve(__dirname, "../../database");
if (!existsSync(_dbDir)) mkdirSync(_dbDir, { recursive: true });

const _sharedDB = new DatabaseSync(join(_dbDir, "storage.db"));
_sharedDB.exec("PRAGMA journal_mode = WAL");

class DBUtils {
	constructor(target, _ignored) {
		this.#table = target;
		_sharedDB.exec(`CREATE TABLE IF NOT EXISTS "${target}" (id INTEGER PRIMARY KEY CHECK (id = 1), value TEXT NOT NULL DEFAULT '{}')`);
		_sharedDB.exec(`INSERT OR IGNORE INTO "${target}" (id, value) VALUES (1, '{}')`);
		this.#stmtRead = _sharedDB.prepare(`SELECT value FROM "${target}" WHERE id = 1`);
		this.#stmtWrite = _sharedDB.prepare(`UPDATE "${target}" SET value = ? WHERE id = 1`);
	}
	#table;
	#stmtRead;
	#stmtWrite;

	#readRoot() {
		const row = this.#stmtRead.get();
		return row ? JSON.parse(row.value) : {};
	}

	#writeRoot(obj) {
		this.#stmtWrite.run(JSON.stringify(obj));
	}

	#resolvePath(key) {
		return key.split("/").filter(Boolean);
	}

	async get(key) {
		return await new Promise((resolve) => {
			try {
				const root = this.#readRoot();
				const segments = this.#resolvePath(key);
				if (!segments.length) return resolve(root);
				let node = root;
				for (const seg of segments) {
					if (node === null || node === undefined || typeof node !== "object") return resolve(null);
					node = node[seg];
				}
				return resolve(node === undefined ? null : node);
			} catch (e) {
				console.error(e);
				return resolve(null);
			}
		});
	}

	async add(key, value, override) {
		return await new Promise((resolve) => {
			try {
				let result;
				_sharedDB.exec("BEGIN");
				try {
					const root = this.#readRoot();
					const segments = this.#resolvePath(key);
					if (!segments.length) {
						const nextRoot = override !== false ? value : Object.assign({}, root, value);
						this.#writeRoot(nextRoot);
						result = nextRoot;
					} else {
						let node = root;
						for (let i = 0; i < segments.length - 1; i++) {
							const seg = segments[i];
							if (node[seg] === null || node[seg] === undefined || typeof node[seg] !== "object") node[seg] = {};
							node = node[seg];
						}
						const last = segments[segments.length - 1];
						if (override !== false) node[last] = value;
						else if (node[last] === undefined) node[last] = value;
						else if (
							node[last] !== null &&
							typeof node[last] === "object" &&
							!Array.isArray(node[last]) &&
							value !== null &&
							typeof value === "object" &&
							!Array.isArray(value)
						) {
							node[last] = Object.assign({}, node[last], value);
						}
						this.#writeRoot(root);

						result = node[last];
					}
					_sharedDB.exec("COMMIT");
				} catch (txErr) {
					_sharedDB.exec("ROLLBACK");
					throw txErr;
				}
				return resolve(result);
			} catch (e) {
				console.error(e);
				resolve(false);
			}
		});
	}

	async remove(key) {
		return await new Promise((resolve) => {
			try {
				_sharedDB.exec("BEGIN");
				try {
					const root = this.#readRoot();
					const segments = this.#resolvePath(key);
					if (!segments.length) {
						this.#writeRoot({});
					} else {
						let node = root;
						let abort = false;
						for (let i = 0; i < segments.length - 1; i++) {
							const seg = segments[i];
							if (node[seg] === null || node[seg] === undefined || typeof node[seg] !== "object") {
								abort = true;
								break;
							}
							node = node[seg];
						}
						if (!abort) {
							delete node[segments[segments.length - 1]];
							this.#writeRoot(root);
						}
					}
					_sharedDB.exec("COMMIT");
				} catch (txErr) {
					_sharedDB.exec("ROLLBACK");
					throw txErr;
				}
			} catch (e) {}
			return resolve();
		});
	}

	async reset() {
		return await new Promise((resolve) => {
			try {
				this.#writeRoot({});
			} catch (e) {}
			return resolve();
		});
	}
}

class CacheDBUtils {
	#db = new Map();
	has(id, key) {
		if (!this.#db.has(id)) return;
		return this.#db.get(id).has(key);
	}
	add(id, key, value) {
		const storage = this.#db.get(id) || new Map();
		storage.set(key, value);
		if (!this.#db.has(id)) this.#db.set(id, storage);
		return true;
	}
	get(id, key) {
		if (!this.#db.has(id)) return;
		return this.#db.get(id).get(key);
	}
	remove(id, key) {
		if (!this.#db.has(id)) return;
		this.#db.get(id).delete(key);
		return true;
	}
	getAll(id) {
		if (!this.#db.has(id)) return;
		return this.#db.get(id);
	}
}

export { DBUtils, CacheDBUtils };
