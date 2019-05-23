const Twitter = require('twitter');
const authAPI = require('./config/twitter.js');
const Friends = require('./db.js').Friends;
const Users = require('./db.js').Users;

const refreshFriendsQueue = require('./config/awsURLs.js').refreshFriendsQueue;

// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');
AWS.config.loadFromPath('./config/aws.json');

// Create an SQS service object
var sqs = new AWS.SQS({apiVersion: '2012-11-05'});

// Client that interacts with the Twitter API.
class TwitterClient {
    client: any;
    constructor (viewer?: any) {
        // Creation of Twitter client.
        this.client = new Twitter({
            consumer_key: authAPI.TWITTER_CONSUMER_KEY,
            consumer_secret: authAPI.TWITTER_CONSUMER_SECRET,
            access_token_key: authAPI.TWITTER_ACCESS_TOKEN_KEY,
            access_token_secret: authAPI.TWITTER_ACCESS_TOKEN_SECRET
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
    addFriend(friendId: string, viewerId: string, oldFriends?: any) {
        // TODO: refine data types for arguments.
        const addFriendTwitter = async (friendId: string) => {
            return new Promise( async (resolve, reject) => {
                const endpoint = 'friendships/create'; 
                const params = {
                    'user_id': friendId
                };
                try {
                    let friend = await this.client.post(endpoint, params);
                    resolve(friend);
                } catch(error) {
                    console.log('Error in addFriendTwitter');
                    reject(error);
                };
            });
        };
        const addFriendDB = async (friend: any, viewerId: string, oldFriends: any) => {
            // TODO: refine data types for arguments.
            let query = {
                'id': viewerId
            };
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
                resolve(friend);
            } catch(err) {
                console.log('ERROR in addFriend', err);
            };
        });
    };

    sendAWSMessageRequest = (message: string, queueURL: string) => {
        const params = {
                DelaySeconds: 10,
                MessageBody: message,
                QueueUrl: queueURL
        };
        sqs.sendMessage(params, function(err: any, data: any) {
            if (err) {
                console.log("Error in refresh-friends", err);
            } else {
                console.log("Success in refresh-friends", data.MessageId);
            }
        });
    }

    // Get all friend ids for a given Twitter user.
    fetchTwitterFriendIds = (userId: string, results: any) => {
        let endpoint = 'friends/ids'; 
        let params = {
            'user_id': userId,
            'count': 5000,
            'cursor': -1,
            'stringify_ids': true
        };
        return new Promise( async (resolve, reject) => {
          try {
            let response = await this.client.get(endpoint, params);
            // add ids to friends for that user
            for (let i = 0; i < response.ids.length; i++) {
                results.push(response.ids[i])
            }
            if (response.next_cursor_str !== "0") {
              params.cursor = response.next_cursor_str;
              results = results.concat(await this.fetchTwitterFriendIds(userId, []));
              resolve(results);
            } else {
              resolve(results);
            } 
          } catch(error) {
            console.log('error in fetchTwitterFriendIds', error);
            reject(error);
          }
        });
      }
      
      // Get fully-hydrated user objects for a given list of ids.
      fetchTwitterUserObjects(ids: any, index: number, results: any) {
          const endpoint = 'users/lookup';
          const maxObjects = 100;
          return new Promise( async (resolve, reject) => {
              try {
                let idsInput = ids.slice(index, index + maxObjects).join(',');
                let params = {
                    'user_id': idsInput
                }
                let response = await this.client.post(endpoint, params);
                // add ids to friends for that user
                for (let i = 0; i < response.length; i++) {
                    results.push(response[i])
                }
                // make API call again if not all users retrieved
                if (index + maxObjects < ids.length) {
                    index += maxObjects;
                    results = results.concat(await this.fetchTwitterUserObjects(ids, index, []));
                    resolve(results);
                } else {
                  resolve(results);
                } 
              } catch(error) {
                console.log('error in fetchTwitterUserObjects', error)
                reject(error);
              }
          });
      }

    // Return friends of a given user.
    getFriends(userId: string, viewerId: string) {
        return new Promise( async (resolve, reject) => {
            try {
                let message = viewerId + '.' + userId;
                let user = await Friends.findOne({id: userId});
                if (user && user.friends.length) {
                    let friends = user.friends;
                    let refreshedFriendsDate = +user.refreshedFriendsDate;
                    let currentDate = +new Date();
                    let hours = Number(Math.abs(refreshedFriendsDate - currentDate) / 36e5);
                    if (hours > 24) {
                        // this.sendAWSMessageRequest(message, refreshFriendsQueue);
                        resolve([friends, false]);
                    } else {
                        resolve([friends, true]);
                    }
                } else {
                    let viewer = await Users.findOne({id: viewerId})
                    // this.sendAWSMessageRequest(message, refreshFriendsQueue);
                    let friend_ids = await this.fetchTwitterFriendIds(userId, []);
                    let friends = await this.fetchTwitterUserObjects(friend_ids, 0, []);
                    resolve([friends, false]);
                }
            } catch(error) {
                console.log('error in getFriends');
                reject(error)
            }
        })
    }
};

// module.exports = TwitterClient;
const mainFunc = async () => {
    let client = new TwitterClient();
    const userId = '1129503751901831168';
    const friendId = '12';
    const friends: any = await client.addFriend(friendId, userId);
    console.log(friends[0]);
}
mainFunc();