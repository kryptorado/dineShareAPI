const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const asyncHandler = require('../middleware/async');
const MatchStatus = require('../utils/MatchStatus');

let usersInQueue = [];
let currentMatches = {};

/**
 * currentMatches example data:
 * 
currentMatches {
        '1234': {
            channelName: '80f3dd5b-2594-4de6-9d0e-6fc6ca753af1',
            token: '00674ee7f95ddc4427e83d12f3c30ade740IACp+0aFvz+IvNJp2pBaIDb1tcIXnBoKwqjsVYA5uP9xeiRHbo2NKSuwIgCKo6/24PMPYgQAAQBwsA5
        iAgBwsA5iAwBwsA5iBABwsA5i',
            otherUser: '3456'
        },
        '3456': {
            channelName: '80f3dd5b-2594-4de6-9d0e-6fc6ca753af1',
            token: '00674ee7f95ddc4427e83d12f3c30ade740IACp+0aFvz+IvNJp2pBaIDb1tcIXnBoKwqjsVYA5uP9xeiRHbo2NKSuwIgCKo6/24PMPYgQAAQBwsA5
        iAgBwsA5iAwBwsA5iBABwsA5i',
            otherUser: '1234'
        }
    }
 */

const MATCHING_INTERVAL = 5000; // how often users in queue get matched
const DEFAULT_NUM_INTERESTS = 5;
const MATCHING_SERVER_URL = 'https://dineshare-matching.herokuapp.com/match';
const AGORA_TOKEN_URL = (channelName) =>
	`https://calm-castle-22371.herokuapp.com/rtc/${channelName}/publisher/uid/0`;

async function getAgoraToken(channelName) {
	const response = await axios
		.get(AGORA_TOKEN_URL(channelName))
		.catch((error) => {
			console.log(error);
		});
	console.log('returned token is: ', response.data.rtcToken);
	return response.data.rtcToken;
}

exports.enterQueue = asyncHandler(async (req, res, next) => {
	if (!usersInQueue.find((element) => element.uId === req.body.uId)) {
		const userInfo = {
			uId: req.body.uId,
			interests: req.body.interests,
		};
		usersInQueue.push(userInfo);
		console.log('current queue ', usersInQueue);
	}
	return res.status(201).json({});
});

exports.pollQueue = asyncHandler(async (req, res, next) => {
	const userId = req.params.uId;

	if (currentMatches[userId]) {
		return res.status(200).json({
			...currentMatches[userId],
			...MatchStatus.FoundMatch,
		});
	}

	if (usersInQueue.length <= 1) {
		res.status(200).json({
			...MatchStatus.NotEnoughUsers,
		});
	} else {
		res.status(200).json({
			...MatchStatus.Matching,
		});
	}
});

exports.doneCall = asyncHandler(async (req, res, next) => {
	// TODO: remove requesting users from the queue as well in case they haven't already been removed
	console.log('Done call called by android');
	return res.status(204).json();
});

// called when something unexpected happens and the user needs to get removed
// from the matching process
exports.cleanup = asyncHandler(async (req, res, next) => {
	// delete matched users from queue
	// remove user from queue
	usersInQueue = usersInQueue.filter(
		// eslint-disable-next-line array-callback-return
		(user) => user.uId !== req.params.uId
	);
	res.status(200).json();
});

async function makeMatches() {
	const formattedList = {}; // queue data in format required by matching server

	formattedList.num_interests = DEFAULT_NUM_INTERESTS;
	usersInQueue.forEach((user) => {
		formattedList[user.uId] = user.interests;
	});
	currentMatches = {};

	if (usersInQueue.length > 1) {
		let queueCopy = [...usersInQueue]; // freeze queue
		usersInQueue = [];

		try {
			const matches = await axios.post(MATCHING_SERVER_URL, formattedList);
			const matchedUserIds = [];

			matches.data.forEach(async (match) => {
				const channelName = uuidv4();
				const token = await getAgoraToken(channelName);

				for (var i = 0, j = 1; i < match.length; i++, j--) {
					matchedUserIds.push(String(match[i]));

					const otherUser = String(match[j]);
					const matchInfo = {
						channelName,
						token,
						otherUser,
					};
					currentMatches[match[i]] = matchInfo;
				}
			});

			// add lonely uses back in queue
			usersInQueue = usersInQueue.concat(queueCopy);
		} catch (error) {
			console.log(error);
		}
	}
}
// calls makeMatches every five seconds
setInterval(makeMatches, MATCHING_INTERVAL);
