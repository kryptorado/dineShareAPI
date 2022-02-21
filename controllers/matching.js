const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const asyncHandler = require('../middleware/async');
const MatchStatus = require('../utils/MatchStatus');

let usersInQueue = [];
const currentMatches = {};

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
			//timeEnteredSystem: Date.now()
		};
		usersInQueue.push(userInfo);
		console.log('current queue ', usersInQueue);
	}
	return res.status(201).json({});
});

exports.pollQueue = asyncHandler(async (req, res, next) => {
	const userId = req.params.uId;
	console.log(userId + ' polling queue');

	// First check if the user is already matched with anyone
	// This could occur if one of the users called pollqueue earlier
	// If yes, (the corresponding match is present) return the match info

	if (currentMatches[userId]) {
		res.status(200).json({
			...currentMatches[userId],
			...MatchStatus.FoundMatch,
		});
	} else {
		const numUsersToMatch = usersInQueue.length;

		if (numUsersToMatch <= 1) {
			res.status(200).json(MatchStatus.NotEnoughUsers);
		} else if (numUsersToMatch === 2) {
			const usersToMatch = [...usersInQueue]; // save user queue state because it could change anytime
			const channelName = uuidv4(); // create channel name
			const token = await getAgoraToken(channelName); // get Agora token

			// delete matched users from queue
			usersInQueue = usersInQueue.filter(
				(user) => usersToMatch.indexOf(user) === -1
			);

			// add both users to the match list
			for (var i = 0, j = 1; i < usersToMatch.length; i++, j--) {
				const otherUser = usersToMatch[j].uId;

				const matchInfo = {
					channelName,
					token,
					otherUser,
				};
				currentMatches[usersToMatch[i].uId] = matchInfo;
			}
			console.log('current matches (case: 2 users): ', currentMatches);

			return res.status(200).json({
				...currentMatches[userId],
				...MatchStatus.FoundMatch,
			});
		} else if (numUsersToMatch >= 3) {
			const formattedList = {}; // queue data in format required by matching server

			formattedList.num_interests = DEFAULT_NUM_INTERESTS;
			usersInQueue.forEach((user) => {
				formattedList[user.uId] = user.interests;
			});

			try {
				const matches = await axios.post(MATCHING_SERVER_URL, formattedList);
				console.log('matches: ', matches.data);
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
					console.log(
						'current matches (case: more than 3 users): ',
						currentMatches
					);

					// remove matched user from queue
					usersInQueue = usersInQueue.filter(
						(user) => matchedUserIds.indexOf(user.uId) === -1
					);

					// return matched or matching states to users
					if (currentMatches[userId]) {
						res.status(200).json({
							...currentMatches[userId],
							...MatchStatus.FoundMatch,
						});
					} else {
						return res.status(200).json({
							...MatchStatus.Matching,
						});
					}
				});
			} catch (error) {
				console.log(error);
				return res.status(400).json({
					...MatchStatus.Error,
				});
			}
		} else {
			console.log('something went wrong');
			return res.status(500).json({
				...MatchStatus.Error,
			});
		}
	}
});

exports.doneCall = asyncHandler(async (req, res, next) => {
	// TODO: remove requesting users from the queue as well in case they haven't already been removed
	try {
		delete currentMatches[req.params.uId];
		console.log('Exit queue called by user ', req.params.uId);
		console.log('current matches: ', currentMatches);

		return res.status(204).json();
	} catch (error) {
		console.log(error);
		return res.status(400).json({
			...MatchStatus.Error,
		});
	}
});

// called when something unexpected happens and the user needs to get removed
// from the matching process
exports.cleanup = asyncHandler(async (req, res, next) => {
	try {
		// remove user from queue
		usersInQueue = usersInQueue.filter(
			// eslint-disable-next-line array-callback-return
			(user) => user.uId !== req.params.uId
		);
		console.log('cleanup called. current queue after delete: ', usersInQueue);

		delete currentMatches[req.params.uId];
		console.log(
			'cleanup called. current matches after delete: ',
			currentMatches
		);

		return res.status(200).json();
	} catch (err) {
		console.log(err);
		return res.status(500).json();
	}
});
