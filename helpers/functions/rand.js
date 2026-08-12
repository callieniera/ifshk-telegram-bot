function random(m = 9, func) {
	const l = {
		str: "0123456789abcdef",
		int: "0123456789",
		token: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_",
	};
	let s = "";
	const r = l[func] || l.str;
	for (let i = 0; i < m; i++) {
		s += r.charAt(Math.floor(Math.random() * r.length));
	}
	return s;
}

const rand = {
	token() {
		return random(32, "token");
	},
	str(m) {
		return random(m, "str");
	},
	int(m) {
		return Number(random(m, "int"));
	},
};

export default rand;
