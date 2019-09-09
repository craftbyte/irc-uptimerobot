const express = require('express'),
	request = require('request'),
	dotenv = require('dotenv'),
	moment = require('moment'),
	irc = require("irc");

dotenv.config()

const channel = process.env.CHANNEL;
const ircOpts = {
	channels: [channel],
	showErrors: true,
	autoRejoin: true,
	realName: 'IRC Uptime Robot Webhook'
}

if (process.env.NICKPASS.length > 0) {
	ircOpts.sasl = true;
	ircOpts.userName = process.env.NICK;
	ircOpts.password = process.env.NICKPASS;
};
if (process.env.SSL == 'true') {
	ircOpts.secure = true;
	ircOpts.port = 6697;
};

// Create the bot name
var bot = new irc.Client(process.env.SERVER, process.env.NICK, ircOpts);
var app = express();
process.on('unhandledRejection', console.error);

var getMonitorStats = function (monitorID, callback) {
	var options = {
		method: 'POST',
		url: 'https://api.uptimerobot.com/v2/getMonitors',
		headers: {
			'cache-control': 'no-cache',
			'content-type': 'application/x-www-form-urlencoded'
		},
		form: {
			api_key: process.env.UPTIME_ROBOT_API_KEY,
			format: 'json',
			logs: '1',
			monitors: monitorID,
			custom_uptime_ratios: 7
		}
	};
	 
	request(options, (error, response, body) => {
		if (error) throw new Error(error);
	 
		callback(JSON.parse(body));
	});
}

app.get('/webhook', (req, res) => {
	const monitorName = req.query.monitorFriendlyName;
	if (req.query.alertType == 1) {
		getMonitorStats(req.query.monitorID, (body) => {
			var lastDown;
			const monitor = body.monitors[0];
			for (let log of monitor.logs) {
				if (log.type == 1 && log.duration > 50) {
					lastDown = moment.unix(log.datetime);
					break
				}
			}
			var message = monitorName + " is DOWN! " + 
			"Last Downtime: " + (lastDown ? lastDown.format("dddd, MMMM Do YYYY \\a\\t H:mm") : 'Never') + 
			" Uptime in last 7 days: " + monitor.custom_uptime_ratio+"%";
			bot.say(channel, message)
		})
	} else if (req.query.alertType == 2) {
		var message = monitorName + " is UP, Downtime Lasted for: " + req.query.alertFriendlyDuration;
		bot.say(channel, message);
	}
	res.end();
})

const port = process.env.PORT || 3000;
app.listen(port, () => {
	console.log('listening on', port)
})
