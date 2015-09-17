var _             = require('underscore');
var Client        = require('node-rest-client').Client;
var Twit          = require('twit');
var async         = require('async');
var wordfilter    = require('wordfilter');
var request       = require('request');
var emojiRegex 	  = require('emoji-regex');
var rita 		  = require('rita');
var levenshtein   = require('fast-levenshtein');

var t = new Twit({
    consumer_key: 			process.env.WHENDIDYOUKNOWBOT_TWIT_CONSUMER_KEY,
    consumer_secret: 		process.env.WHENDIDYOUKNOWBOT_TWIT_CONSUMER_SECRET,
    app_only_auth: 			true
});

var tf = new Twit({
    consumer_key: 			process.env.WHENDIDYOUKNOWBOT_TWIT_CONSUMER_KEY,
    consumer_secret: 		process.env.WHENDIDYOUKNOWBOT_TWIT_CONSUMER_SECRET,
    access_token: 			process.env.WHENDIDYOUKNOWBOT_TWIT_ACCESS_TOKEN,
    access_token_secret: 	process.env.WHENDIDYOUKNOWBOT_TWIT_ACCESS_TOKEN_SECRET
});

var wordnikKey = 			process.env.WHENDIDYOUKNOWBOT_WORDNIK_KEY;

// RiTa.js
var lexicon = new rita.RiLexicon();

// Levenshtein distance, to avoid similar strings.
// var levenshteinThreshold = 10;

// Bad words
wordfilter.addWords(['nigga', 'niggas', 'nigg', 'pussies', 'gay']);

// Custom characters
wordfilter.addWords(['@','#', 'http', 'www']);

// Tracking the rejects
var statsTracker = {
	total: 0,
	accepted: 0,
	rejectTracker: {
		blacklisted: 0,
		noPatternMatch: 0
	}
};

var searchQueries = [
	{ query: "\"i%20knew%20when\"", pattern: "" },
	{ query: "when%20AND%20\"i%20knew\"", pattern: "when" },
	{ query: "before%20AND%20\"i%20knew\"", pattern: "before" },
	{ query: "after%20AND%20\"i%20knew\"", pattern: "after" }	
];

var randomNum = Math.floor(Math.random() * searchQueries.length),
	query = searchQueries[randomNum].query,
	regexPattern = searchQueries[randomNum].pattern;

console.log(query);
console.log(regexPattern);

getPublicTweet = function(cb) {
    t.get('search/tweets', {q: query, count: 100, result_type: 'recent', lang: 'en'}, function(err, data, response) {
		if (!err) {
			// if (regexPattern != "") {
			// 	var regex = new RegExp("^" + regexPattern, "g");
			// }

			// var pattern = /^when/;
			var botData = {
				allPosts: []
			};
			
			// Loop through all returned statues
			for (var i = 0; i < data.statuses.length; i++) {

				var tweet = data.statuses[i].text.toLowerCase(),
					hasReply = tweet.indexOf('@'), 
					hasHashtag = tweet.indexOf('#'),
					hasLink = tweet.indexOf('http'),
					hasAmp = tweet.indexOf('&');


				// var username = data.statuses[i].user.screen_name;
				// if (/milton_book/.test(username)) {
				// 	statsTracker.rejectTracker.paradiseFound++;
				// 	continue;
				// };

				// Does the tweet contain offensive words?
				if (wordfilter.blacklisted(tweet)) {
					statsTracker.rejectTracker.blacklisted++;
					continue;
				};

				// if (randomNum != 0) {
				// 	var regex = new RegExp("^" + regexPattern, "g");
				// 	if (regex.test(tweet) == false) {
				// 		statsTracker.rejectTracker.noPatternMatch++;
				// 		continue;
				// 	}
				// }

				if ((hasReply == -1) && (hasHashtag == -1) && (hasLink == -1) && (hasAmp == -1)) {
					botData.allPosts.push(data.statuses[i].text);
				}

			}







			if (botData.allPosts.length > 0 ) {
				// Remove duplicates
				botData.allPosts = _.uniq(botData.allPosts);
       			cb(null, botData);
			} else {
				cb("No tweets matching search criteria.");
			}
		} else {
			cb("There was an error getting a public Tweet. Abandoning EVERYTHING :(");
		}
    });
};


showEm = function(botData, cb) {
	for (var i = 0; i < botData.allPosts.length; i++) {
		console.log(botData.allPosts[i]);
	};
	cb(null);
}


rateLimitCheck = function(cb) {
	console.log('---------------------------');
    t.get('application/rate_limit_status', {resources: 'search'}, function (err, data, response) {
		if (!err) {
			var dataRoot = data.resources.search['/search/tweets'],
				limit = dataRoot.limit,
				remaining = dataRoot.remaining,
				resetTime = dataRoot.reset + "000",
				currentTime = (new Date).getTime().toString(),
				msRemaining = resetTime - currentTime,
				totalSecsRemaining = Math.floor(msRemaining / 1000),
				minRemaining = Math.floor(totalSecsRemaining/60),
				secRemaining = totalSecsRemaining%60;

			if (secRemaining < 10) { secRemaining = "0" + secRemaining; }

			var timeUntilReset = new Date(0);
			timeUntilReset.setUTCSeconds(dataRoot.reset);

			var hour = timeUntilReset.getHours();
			if (hour > 12) { hour = hour - 12; };
			var min = timeUntilReset.getMinutes();
			if (min < 10) { min = "0" + min; };
			var sec = timeUntilReset.getSeconds();
			if (sec < 10) { sec = "0" + sec; };

			console.log("Rate limit: " + remaining + "/" + limit);
			console.log("Next reset at: " + hour + ":" + min + ":" + sec + " in " + minRemaining + ":" + secRemaining );

			console.log('---------------------------');
			console.log(JSON.stringify(statsTracker.rejectTracker, null, 2));
		}
	});
}


// ===========================
// Execute
// ===========================
run = function() {
	console.log("========= Starting! =========");

    async.waterfall([
		getPublicTweet,
		showEm,
		rateLimitCheck
    ],
    function(err, botData) {
		if (err) {
			console.log('Error: ', err);
			rateLimitCheck();
		}
    });
}

run();