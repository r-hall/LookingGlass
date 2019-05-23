import express = require('express');
import bodyParser = require('body-parser');
import morgan = require('morgan');
import cors = require('cors');
const Users = require('./db.ts').Users;
const Friends = require('./db.ts').Friends;
const TwitterClient = require('./TwitterClient.ts');
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
})

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
    let client = new TwitterClient(viewer)
    let friends = await client.getFriends(userId, viewerId);
    res.writeHead(200)
    res.end(JSON.stringify(friends))
  } catch(err) {
    console.log('ERROR in friendsAPI', err);
    res.writeHead(404);
    res.end(err);
  }
})

app.listen(port, () => {
	console.log(`listening on port ${port}`);
})
