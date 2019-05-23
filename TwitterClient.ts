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

    // Make a call to the Twitter API to retrieve Twitter users matching a given query.
    searchUsers(query: string) {
        const endpoint = 'users/search';
        const numUsers = 20;
        return new Promise( async (resolve, reject) => {
            try {
                const users = await this.client.get(
                    endpoint, 
                    {
                        'q': query,
                        'count': numUsers
                    }
                );
                resolve(JSON.stringify(users));
            } catch(err) {
                console.log('ERROR in searchUsers', err);
                reject(err);
            }
        })
    }
}

module.exports = TwitterClient;