const Twitter = require('twitter');
const authAPI = require('./config/twitter.js');

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
    }

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
            }
        })
    }
    
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
            }
        })
    }
}

module.exports = TwitterClient;