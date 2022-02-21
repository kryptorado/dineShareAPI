class MatchStatus {
	static FoundMatch = new MatchStatus('FOUND_MATCH');

	static Matching = new MatchStatus('MATCHING');

	static NotEnoughUsers = new MatchStatus('NOT_ENOUGH_USERS');

	static Error = new MatchStatus('ERROR');

	constructor(state) {
		this.state = state;
	}
}
module.exports = MatchStatus;
