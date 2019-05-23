const Twitter = require('twitter');
const authAPI = require('./config/twitter.js');
const Friends = require('./db.ts').Friends;

// Client that interacts with the Twitter API.
class TwitterClient {
    client: any;
    constructor (viewer: any) {
        // Creation of Twitter client.
        this.client = new Twitter({
            consumer_key: authAPI.TWITTER_CONSUMER_KEY,
            consumer_secret: authAPI.TWITTER_CONSUMER_SECRET,
            access_token_key: viewer.twitterTokenKey,
            access_token_secret: viewer.twitterTokenSecret
        });
    };

    // Retrieve Twitter users matching a given query.
    searchUsers(query: string) {
        const endpoint = 'users/search';
        const numUsers = 20;
        return new Promise( async (resolve, reject) => {
            try {
                let users = await this.client.get(
                    endpoint, 
                    {
                        'q': query,
                        'count': numUsers
                    }
                );
                resolve(users);
            } catch(err) {
                console.log('ERROR in searchUsers', err);
                reject(err);
            };
        });
    };
    
    // Return 200 most recent likes of a given user.
    getLikes(userId: string) {
        const endpoint = 'favorites/list';
        const params = {
            'user_id': userId,
            'count': 200,
            'include_entities': true,
            'tweet_mode': 'extended'
        };
        return new Promise( async (resolve, reject) => {
            try {
                let likes = await this.client.get(endpoint, params);
                resolve(likes);
            } catch(error) {
                console.log('error in twitterFetchLikes', error)
                reject(error);
            };
        });
    };
    
    // Add Friend on Twitter and in LookingGlass DB for given user.
    addFriend(friendId: string, viewerId: string, oldFriends: any) {
        // TODO: refine data types for arguments.
        const addFriendTwitter = async (friendId: string) => {
            const endpoint = 'friendships/create'; 
            const friendParams = {
                'user_id': friendId
            };
            return this.client.post(endpoint, friendParams);
        };
        const addFriendDB = async (friend: any, viewerId: string, oldFriends: any) => {
            // TODO: refine data types for arguments.
            let query = {};
            query['id'] = viewerId;
            let newFriend = {
                'id_str': friend.id_str,
                'name': friend.name,
                'screen_name': friend.screen_name,
                'profile_image_url_https': friend.profile_image_url_https,
                'followers_count': friend.followers_count,
                'likes': 0,
                'description': friend.description,
                'verified': friend.verified
            };
            oldFriends.push(newFriend);
            let updateObject = {
                'friends': oldFriends
            };
            Friends.findOneAndUpdate(query, updateObject);
        };
        return new Promise( async (resolve, reject) => {
            try {
                let friend = await addFriendTwitter(friendId);
                addFriendDB(friend, viewerId, oldFriends);
                resolve(JSON.stringify(friend));
            } catch(err) {
                console.log('ERROR in addFriend', err);
            };
        });
    };
};

module.exports = TwitterClient;