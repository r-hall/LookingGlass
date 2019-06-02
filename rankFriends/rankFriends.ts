const TwitterClient = require('../TwitterClient.js');
const Friends = require('../db.js').Friends;

interface Store {
	[key: string]: any;
}

interface EngagementValues {
	likes?: any;
	retweets?: any;
}

// Rank objects by likes and then by follower count.
const compareUserFriends = (a: any, b: any) => {
	if (a.engagementValue > b.engagementValue)
		return -1;
	if (a.engagementValue < b.engagementValue)
		return 1;
	if (a.followers_count > b.followers_count)
		return -1;
	if (a.followers_count < b.followers_count)
		return 1;
	return 0;
};

// Weight value by time passed. More recent means a higher value.
const weightByTime = (value: any) => {
	const DOWNWEIGHT_VALUE = 0.975;
	const millisecondsInWeek = 1000*60*60*24*7;
	let currentDate = new Date().getTime();
	let likeDate = new Date(value.created_at).getTime();
	let weeksPassed = Math.floor(Math.abs(currentDate - likeDate) / millisecondsInWeek);
	return DOWNWEIGHT_VALUE**(weeksPassed);
};

// Fetch all engagment values to be used in computation.
const fetchEngagementValues = (client: any, user: any) => {
	return new Promise(async (resolve, reject) => {
		try {
			let engagementValues: EngagementValues = {};
			let likes = await client.getLikesBatch(user, 1000);
			engagementValues['likes'] = likes;
			resolve(engagementValues);
		} catch(error) {
			console.log('error in fetchEngagementValues', error);
			reject(error);
		};
	});
};

// Compute engagement.
const computeEngagementScores = (store: Store, engagementValues: EngagementValues) => {
	for (let i = 0; i < engagementValues['likes'].length; i++) {
		let userId = engagementValues['likes'][i]['user']['id_str'];
		if (store.hasOwnProperty(userId)) {
			store[userId]['engagementValue'] += weightByTime(engagementValues['likes'][i]);
		};
	};
}

// Rank friends of a given user by engagement.
export const rankFriends = (authenticatingUser: any, user: any) => {
	return new Promise(async (resolve, reject) => {
		try {
			let client = new TwitterClient(authenticatingUser);
			let friends = await client.getFriends(user, authenticatingUser);
			let engagementValues: EngagementValues = await fetchEngagementValues(client, user);
			let store: Store = {};
			// Build store with an entry for each of the user's friends.
			for (let i = 0; i < friends.length; i++) {
                let temp = {
                    'engagementValue': 0.0,
                    'description': friends[i]['description'] ? friends[i]['description'] : '',
                    'followers_count': friends[i]['followers_count'],
                    'name': friends[i]['name'],
                    'screen_name': friends[i]['screen_name'],
                    'verified': friends[i]['verified']
				};
                store[friends[i]['id_str']] = temp;
            };
            computeEngagementScores(store, engagementValues);
            let rankedFriends = [];
			let keys = Object.keys(store);
            for (let i = 0; i < keys.length; i++) {
                let temp = {
                    'id_str': keys[i],
                    'engagementValue': store[keys[i]]['engagementValue'],
                    'description': store[keys[i]]['description'] ? store[keys[i]]['description'] : '',
                    'followers_count': store[keys[i]]['followers_count'],
                    'name': store[keys[i]]['name'],
                    'screen_name': store[keys[i]]['screen_name'],
                    'verified': store[keys[i]]['verified']
                };
                rankedFriends.push(temp);
            };
            rankedFriends.sort(compareUserFriends);
			let query = { 'id': user };
			let updateObject = {
				'id': user,
				'friends': rankedFriends,
				'refreshedFriendsDate': new Date()
			};
			await Friends.findOneAndUpdate(query, updateObject, {upsert: true});
			resolve(rankedFriends);
		} catch(error) {
			console.log('error in rankFriends', error);
			reject(false);
		};
	});
};