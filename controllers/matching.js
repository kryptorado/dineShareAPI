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

const AGORA_TOKEN_URL = (channelName) =>
	`https://calm-castle-22371.herokuapp.com/rtc/${channelName}/publisher/uid/0}`;
const MATCHING_SERVER_URL = 'https://dineshare-matching.herokuapp.com/match';
const DEFAULT_NUM_INTERESTS = 5;

async function getAgoraToken(channelName) {
	const response = await axios
		.get(AGORA_TOKEN_URL(channelName))
		.catch((error) => {
			console.log(error);
		});
	return response.data.rtcToken;
	// return '00674ee7f95ddc4427e83d12f3c30ade740IACp+0aFvz+IvNJp2pBaIDb1tcIXnBoKwqjsVYA5uP9xeiRHbo2NKSuwIgCKo6/24PMPYgQAAQBwsA5iAgBwsA5iAwBwsA5iBABwsA5i';
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
			// match them immediately
			const usersToMatch = [...usersInQueue]; // save user queue state because it could change anytime
			usersInQueue = usersInQueue.filter(
				(item) =>
					// delete matched users from queue
					usersToMatch.indexOf(item) === -1
			);

			const channelName = uuidv4(); // create channel name
			const token = await getAgoraToken(channelName); // get Agora token

			for (var i = 0, j = 1; i < usersToMatch.length; i++, j--) {
				const otherUser = usersToMatch[j].uId;

				const matchInfo = {
					// add both users to the match list
					channelName,
					token,
					otherUser,
				};
				currentMatches[usersToMatch[i].uId] = matchInfo;
			}

			return res.status(200).json({
				...currentMatches[userId],
				...MatchStatus.FoundMatch,
			});
		} else if (numUsersToMatch >= 3) {
			// hold queue data in format required by matching server
			const formattedList = {};

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

					// remove matched userIds from queue
					usersInQueue = usersInQueue.filter(
						(user) =>
							// delete matched users from queue
							matchedUserIds.indexOf(user.uId) === -1
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
			return res.status(500);
		}
	}
});

exports.doneCall = asyncHandler(async (req, res, next) => {
	try {
		delete currentMatches[req.params.uId];
		console.log('current matches: ', currentMatches);
		return res.status(204).json();
	} catch (error) {
		console.log(error);
		return res.status(400).json({
			...MatchStatus.Error,
		});
	}
});
