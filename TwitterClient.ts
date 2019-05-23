const Twitter = require('twitter');
const authAPI = require('./config/twitter.js');

class TwitterClient {
    client: any;
    searchUsersEndpoint: string;
    searchUsersCount : number;
    constructor (viewer: any) {
        // Creation of Twitter client.
        this.client = new Twitter({
            consumer_key: authAPI.TWITTER_CONSUMER_KEY,
            consumer_secret: authAPI.TWITTER_CONSUMER_SECRET,
            access_token_key: viewer.twitterTokenKey,
            access_token_secret: viewer.twitterTokenSecret
        });
        // Parameters for searchUsers.
        this.searchUsersEndpoint = 'users/search';
        this.searchUsersCount = 20;
    }

    // Make a call to the Twitter API to retrieve Twitter users matching a given query.
    searchUsers(query: string) {
        return new Promise( async (resolve, reject) => {
            try {
                // Twitter API call.
                const users = await this.client.get(
                    this.searchUsersEndpoint, 
                    {
                        'q': query,
                        'count': this.searchUsersCount
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