export default (app, val1, val2, displaytime) => {
	const colours = {
		reset: "\x1b[0m",
		bright: "\x1b[1m",
		dim: "\x1b[2m",
		underscore: "\x1b[4m",
		blink: "\x1b[5m",
		reverse: "\x1b[7m",
		hidden: "\x1b[8m",

		fg: {
			black: "\x1b[30m",
			red: "\x1b[31m",
			green: "\x1b[32m",
			yellow: "\x1b[33m",
			blue: "\x1b[34m",
			magenta: "\x1b[35m",
			cyan: "\x1b[36m",
			white: "\x1b[37m",
			gray: "\x1b[90m",
		},
		app: {
			appstart: "\x1b[31m",

			telegram: "\x1b[34m",
		},
	};
	const timefn = displaytime ? new Date(displaytime) : new Date();
	const timetext = new Date(timefn.setHours(timefn.getHours() + Number(process.env.timezone || 8))).toJSON();
	const returnValue = [`${colours.fg.gray}${timetext}${colours.reset} `, `${colours.app[app] || colours.fg.yellow}${app}${colours.reset}: `, `${val1} `];
	if (val2) returnValue.push(`${colours.app[app]}${val2}${colours.reset}`);
	return console.log(returnValue.join(""));
};
