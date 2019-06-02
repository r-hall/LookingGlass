// Twitter library
const Twitter = require('twitter');
// Twitter application authentication credentials
const authAPI = require('./config/twitter.js');
// Mongoose models
const Friends = require('./db.js').Friends;
const Users = require('./db.js').Users;
// const Lists = require('./db.js').Lists;
// Utils
const calculateNextDate = require('./utils/calculateNextDate.js').calculateNextDate;
const boundLikes = require('./utils/boundInput.js').boundLikes;
const computeMinId = require('./utils/computeMinId.js').computeMinId;
const getListId = require('./utils/getListId.js').getListId;

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
    
    // Return 200 most recent likes older than a given tweet of a given user.
    getLikes(userId: string, maxId?: string, minId?: string) {
        const endpoint = 'favorites/list';
        let params: any = {
            'user_id': userId,
            'count': 200,
            'include_entities': true,
            'tweet_mode': 'extended'
        };
        if (maxId) { params['max_id'] = maxId; };
        if (minId) { params['since_id'] = minId; };
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

    // Return given number of likes of a given user.
    getLikesBatch(userId: string, numLikes: number) {
        const maxLikesPerBatch = 200;
        numLikes = boundLikes(numLikes);
        const numBatches = Math.ceil(numLikes / maxLikesPerBatch)
        const endpoint = 'favorites/list';
        return new Promise( async (resolve, reject) => {
            try {
                let likes: any = [];
                let count = numLikes > maxLikesPerBatch ? maxLikesPerBatch : numLikes;
                let params: any = {
                    'user_id': userId,
                    'count': count,
                    'include_entities': true,
                    'tweet_mode': 'extended'
                };
                for (let i = 0; i < numBatches; i++) {
                    let batchLikes = await this.client.get(endpoint, params);
                    likes.push(...batchLikes);
                    numLikes -= count;
                    let minId = computeMinId(batchLikes);
                    params['max_id'] = minId;
                    count = numLikes > maxLikesPerBatch ? maxLikesPerBatch : numLikes;
                    params['count'] = count;
                };
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
                // addFriendDB(friend, viewerId, oldFriends);
                resolve(friend);
            } catch(err) {
                console.log('ERROR in addFriend', err);
            };
        });
    };

    sendAWSMessageRequest(message: string, queueURL: string) {
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
            };
        });
    };

    // Get all friend ids for a given Twitter user.
    _fetchTwitterFriendIds(userId: string) {
        let endpoint = 'friends/ids'; 
        let params = {
            'user_id': userId,
            'count': 5000,
            'cursor': -1,
            'stringify_ids': true
        };
        return new Promise( async (resolve, reject) => {
          try {
            let response;
            let results = [];
            while (params.cursor !== 0) {
                response = await this.client.get(endpoint, params);
                for (let i = 0; i < response.ids.length; i++) {
                    results.push(response.ids[i]);
                };
                params.cursor = response.next_cursor;
            }
            resolve(results);
          } catch(error) {
            console.log('error in fetchTwitterFriendIds', error);
            reject(error);
          };
        });
      };
      
      // Get fully-hydrated user objects for a given list of ids.
      _fetchTwitterUserObjects(ids: any, index: number, results: any) {
          const endpoint = 'users/lookup';
          const maxObjects = 100;
          return new Promise( async (resolve, reject) => {
              try {
                let idsInput = ids.slice(index, index + maxObjects).join(',');
                let params = {
                    'user_id': idsInput
                };
                let response = await this.client.post(endpoint, params);
                // add ids to friends for that user
                for (let i = 0; i < response.length; i++) {
                    results.push(response[i])
                };
                // make API call again if not all users retrieved
                if (index + maxObjects < ids.length) {
                    index += maxObjects;
                    results = results.concat(await this._fetchTwitterUserObjects(ids, index, []));
                    resolve(results);
                } else {
                  resolve(results);
                };
              } catch(error) {
                console.log('error in fetchTwitterUserObjects', error)
                reject(error);
              };
          });
      };

    // Return friends of a given user.
    getFriends(userId: string, viewerId: string) {
        return new Promise( async (resolve, reject) => {
            try {
                // let message = viewerId + '.' + userId;
                // let user = await Friends.findOne({id: userId});
                // if (user && user.friends.length) {
                //     let friends = user.friends;
                //     let refreshedFriendsDate = +user.refreshedFriendsDate;
                //     let currentDate = +new Date();
                //     let hours = Number(Math.abs(refreshedFriendsDate - currentDate) / 36e5);
                //     if (hours > 24) {
                //         // this.sendAWSMessageRequest(message, refreshFriendsQueue);
                //         resolve(friends);
                //     } else {
                //         resolve(friends);
                //     };
                // } else {
                    // this.sendAWSMessageRequest(message, refreshFriendsQueue);
                    let friend_ids = await this._fetchTwitterFriendIds(userId);
                    let friends = await this._fetchTwitterUserObjects(friend_ids, 0, []);
                    resolve(friends);
                // };
            } catch(error) {
                console.log('error in getFriends');
                reject(error);
            };
        });
    };
    
    // Return 200 most recent tweets, excluding replies, older than given tweet of a given user.
    getTweets(userId: string, maxId?: string, minId?: string) {
        return new Promise( async (resolve, reject) => {
            try {
                let endpoint = 'statuses/user_timeline'; 
                let params: any = {
                    'user_id': userId,
                    'count': 200,
                    'tweet_mode': 'extended',
                    'exclude_replies': true,
                    'include_rts': false
                };
                if (maxId) { params['max_id'] = maxId; };
                if (minId) { params['since_id'] = minId; };
                let tweets = await this.client.get(endpoint, params);
                resolve(tweets);
            } catch(error) {
                console.log('ERROR in getTweets', error);
                reject(error);
            };
        });
    };

    // Get user object for given user.
    getUser(userId: string) {
        return new Promise( async (resolve, reject) => {
            try {
                let endpoint = 'users/show'; 
                let params = {
                    'user_id': userId
                };
                let user = await this.client.get(endpoint, params);
                resolve(user);
            } catch(err) {
                console.log('ERROR in getUserObject', err);
                reject(err);
            };
        });
    };
    
    // Get first 200 tweets in user's timeline.
    getOwnTimeline(userId: string, maxId?: string, minId?: string) {
        return new Promise( async (resolve, reject) => {
            try {
                // TODO: Handle rate limits.
                let endpoint = 'statuses/home_timeline'; 
                let params: any = {
                    'count': 200,
                    'tweet_mode': 'extended'
                };
                if (maxId) { params['max_id'] = maxId; };
                if (minId) { params['since_id'] = minId; };
                let timeline = await this.client.get(endpoint, params);
                resolve(timeline);
            } catch(error) {
                console.log('ERROR in getOwnTimeline', error);
                reject(error);
            }
        })
    }

    // Get 200 tweets from timeline given list.
    getListTimeline(list: any, maxId?: string, minId?: string) {
        // TODO: Make list interface.
        return new Promise( async (resolve, reject) => {
            try {
                const endpoint = 'lists/statuses';
                let params: any = {
                    'list_id': getListId(list),
                    'count': 200,
                }
                if (maxId) { params['max_id'] = maxId; };
                if (minId) { params['since_id'] = minId; };
                let timeline = await this.client.get(endpoint, params);
                resolve(timeline);
            } catch(err) {
                console.log('error in getListTimeline', err);
                reject(err);
            }
        })
    }

    getListsByOwner(user_id: string) {
        return new Promise( async (resolve, reject) => {
            try {
                const endpoint = 'lists/list';
                let params = {
                    'user_id': user_id
                }
                let lists = await this.client.get(endpoint, params);
                resolve(lists);
            } catch(err) {
                console.log('error in getListTimeline', err);
                reject(err);
            }
        })
    }

    createList(name: string) {
        return new Promise( async (resolve, reject) => {
            try {
                const endpoint = 'lists/create';
                const params = {
                    'name': name
                }
                let list = await this.client.post(endpoint, params);
                resolve(list);
            } catch(error) {
                console.log('error in createList');
                reject(error);
            };
        });
    };

    addMembersToList(id: string, members: any) {
        return new Promise( async (resolve, reject) => {
            try {
                const endpoint = 'lists/members/create_all';
                const params = {
                    'list_id': id,
                    'user_id': members.join(',')
                }
                let list = await this.client.post(endpoint, params);
                resolve(list);
            } catch(error) {
                console.log('error in createList');
                reject(error);
            };
        });
    }

    async requestList(name: string, userId: string, listCreatorId: string) {
        return new Promise( async (resolve, reject) => {
            try {
                // Create list.
                let list = await this.createList(name);
                // Fetch members to add to list.
                let friends: any = await this._fetchTwitterFriendIds(userId);
                this.addMembersToList(getListId(list), friends);
                // Add list to db.
                resolve(list);
            } catch(error) {
                console.log('error in requestList');
                reject(error);
            };
        });
    };


    // async requestList(name: string, userId: string, viewerId: string) {
    //     try {
    //         // Ensure the rate limit for GET lists/statuses is not exceeded.
    //         const maxLists = 50;
    //         // Add a safe amount to list each day, assuming some members are added by the user outside of this app.
    //         const maxDailyInsertions = 400;
    //         let viewer = await Users.findOne({id: viewerId});
    //         // TODO: What if they aren't? Need to find a suitable user to build the list.
    //         if (viewer.numberOfLists < maxLists) {
    //             let params = {
    //                 'user_id': userId,
    //                 'count': 5000,
    //                 'cursor': -1,
    //                 'stringify_ids': true
    //             };
    //             let friends: any = await this._fetchTwitterFriendIds(userId, []);
    //             const batches = Math.ceil(friends.length / maxDailyInsertions);
    //             let currentDate = new Date();
    //             let dateUsed = currentDate > viewer.lastListBuild ? currentDate : viewer.lastListBuild;
    //             let endBuildDate = calculateNextDate(dateUsed, batches);
    //             let listQuery = { 'id': name };
    //             let listUpdateObject = {
    //                 'id': name,
    //                 'done': false,
    //                 'batches': batches,
    //                 'friends': friends,
    //                 'currentBatch': 0,
    //             }
    //             Lists.findOneAndUpdate(listQuery, listUpdateObject, {upsert: true});
    //             let userQuery = { 'id': viewerId };
    //             let userUpdateObject = { 'lastListBuild': endBuildDate };
    //             Users.findOneAndUpdate(userQuery, userUpdateObject);
    //             scheduleJobs(sqs, name, viewerId, dateUsed, batches); // schedule messages to lambda function that will build list
    //         }
    //     } catch(err) {
    //         console.log('error in requestList', err);
    //     }
    // }
};

module.exports = TwitterClient;