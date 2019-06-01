import express = require('express');
import bodyParser = require('body-parser');
import morgan = require('morgan');
import cors = require('cors');
// Mongoose models
const Users = require('./db.js').Users;
const Friends = require('./db.js').Friends;
const Lists = require('./db.js').Lists;

const TwitterClient = require('./TwitterClient.js');
const port = process.env.PORT || 3001;

var app = express();

// Logging and parsing
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cors());

app.get('/health', (req, res) => {
  res.writeHead(200);
  res.end('healthy');
});

app.get('/search', async (req, res) => {
    try {
      // Text to use in query.
      const text = req.query.text;
      // LookingGlass user id used to fetch tokens from db which are used in Twitter API request.
      const viewerId = req.query.viewerId;
      const viewer = await Users.findOne({id: viewerId});
      const client = new TwitterClient(viewer);
      const users = await client.searchUsers(text);
      res.writeHead(200);
      res.end(JSON.stringify(users));
    } catch(err) {
      console.log('ERROR in /search', err);
      res.writeHead(404);
      res.end(err);
    };
});

app.get('/likes', async (req, res) => {
  try {
    // User whose likes to fetch and viewer whose tokens to use in API request.
    const userId = req.query.userId;
    const viewerId = req.query.viewerId;
    const viewer = await Users.findOne({id: viewerId});
    const client = new TwitterClient(viewer);
    const likes = await client.getLikes(client, userId);
    res.writeHead(200);
    res.end(JSON.stringify(likes));
  } catch(err) {
    res.writeHead(404);
    res.end(err);
  };
});

app.post('/friends', async (req, res) => {
  try {
    // Id of the friend to be added.
    let friendId = req.query.friendId;
    // LookingGlass user for whom the friend will be added. 
    let viewerId = req.query.viewerId;
    // TODO: Combine Users.findOne and Friends.findOne into one promise.
    let viewer = await Users.findOne({id: viewerId});
    let friends = await Friends.findOne({id: viewerId});
    let client = new TwitterClient(viewer);
    let friend = await client.addFriend(friendId, viewerId, friends);
    res.writeHead(201);
    res.end(JSON.stringify(friend));
  } catch(err) {
    console.log('ERROR in post /friends', err);
    res.writeHead(404);
    res.end(err);
  };
});

app.get('/friends', async (req, res) => {
  try {
    let userId = req.query.userId;
    let viewerId = req.query.viewerId;
    let viewer = await Users.findOne({id: viewerId});
    let client = new TwitterClient(viewer);
    let friends = await client.getFriends(userId, viewerId);
    res.writeHead(200);
    res.end(JSON.stringify(friends));
  } catch(err) {
    console.log('ERROR in get /friends', err);
    res.writeHead(404);
    res.end(err);
  };
});

app.get('/tweets', async (req, res) => {
  try {
    let userId = req.query.userId;
    let user = await Users.findOne({id: userId});
    let client = new TwitterClient(user);
    let tweets = await client.getTweets(userId);
    res.writeHead(200);
    res.end(JSON.stringify(tweets));
  } catch(err) {
    console.log('ERROR in /tweets', err);
    res.writeHead(404);
    res.end(err);
  };
});

app.get('/user', async (req, res) => {
  try {
    let userId = req.query.userId;
    let viewerId = req.query.viewerId;
    let viewer = await Users.findOne({id: viewerId});
    let client = new TwitterClient(viewer);
    let user = await client.getUser(client, userId);
    res.writeHead(200);
    res.end(JSON.stringify(user));
  } catch(err) {
    console.log('ERROR in /user', err);
    res.writeHead(404);
    res.end(err);
  };
});

// app.get('/timeline', async (req, res) => {
//   try {
//     let userId = req.query.userId;
//     let name = req.query.userScreenName;
//     let viewerId = req.query.viewerId;
//     let user = await Users.findOne({id: userId});
//     let client = new TwitterClient(user);
//     if (user && user.twitterTokenKey) {
//       let timeline = await client.getOwnTimeline(client, userId);
//       res.writeHead(200);
//       res.end(JSON.stringify(timeline));
//     } else {
//       let list = await Lists.findOne({id: name});
//       // TODO: Error handling -- user deletion of list on Twitter.
//       if (list && list.done) {
//         let timeline = await client.getListTimeline(list);
//         res.writeHead(200);
//         res.end(JSON.stringify(timeline));
//       } else {
//         client.requestList(name, userId, viewerId);
//         let tokenInfo = await TokenTracker.findOne({id: 1});
//         let currentToken = tokenInfo.currentToken;
//         let totalTokens = tokenInfo.totalTokens;
//         let updateObject = {};
//         let newCurrentToken = currentToken === totalTokens ? 1 : currentToken + 1;
//         updateObject['currentToken'] = newCurrentToken;
//         let query = {'id': 1};
//         TokenTracker.findOneAndUpdate(query, updateObject);
//         let token = await Tokens.findOne({id: currentToken});
//         let tokenKey = token.twitterTokenKey;
//         let tokenSecret = token.twitterTokenSecret;
//         let timeline = await getOtherTimeline(tokenKey, tokenSecret, userId, sqs);
//         res.writeHead(200);
//         res.end(timeline);
//       }
//     }
//   } catch(err) {
//     console.log('error in /timeline/:userId/:userScreenName/:viewerId', err);
//     res.writeHead(404);
//     res.end(err);
//   }
// })

app.listen(port, () => {
	console.log(`listening on port ${port}`);
})
