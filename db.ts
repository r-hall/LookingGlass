import mongoose = require('mongoose');
mongoose.Promise = Promise; 
const url = require('./config/db.js');
mongoose.connect(url);

let db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  // we're connected!
  console.log('we are connected to lookingglass!');
});

// TODO: make separate file for each schema and store them in db folder.
const userSchema : mongoose.Schema = new mongoose.Schema({
	id: {type: String, index: true, unique: true},
	twitterTokenKey: {type: String, default: ''},
	twitterTokenSecret: {type: String, default: ''},
	tokenNumber: Number
});

interface IUser extends mongoose.Document {
  id: string;
  twitterTokenKey: string;
  twitterTokenSecret: string;
  tokenNumber: number;
}

const UserModel: mongoose.Model<IUser> = mongoose.model<IUser>('User', userSchema);

let friendSchema : mongoose.Schema = new mongoose.Schema({
	id: {type: String, index: true, unique: true},
	friends: [{
		id_str: String,
		name: String,
		screen_name: String,
		profile_image_url_https: String,
		followers_count: Number,
		likes: Number,
		description: String,
		verified: Boolean
	}],
	refreshedFriendsDate: {type: Date, default: '1/1/2019'}
});

interface Friend {
	id_str: string;
	name: string;
	screen_name: string;
	profile_image_url_https: string;
	followers_count: number;
	likes: number;
	description: string;
	verified: boolean;
}

interface IFriend extends mongoose.Document {
  	id: string;
	friends: Array<Friend>;
	refreshedFriendsDate: Date;
}

const FriendModel: mongoose.Model<IFriend> = mongoose.model<IFriend>('Friend', friendSchema);

const listSchema : mongoose.Schema = new mongoose.Schema({
	id: {type: String, index: true, unique: true},
	name: String,
	endDate: String,
	refreshedDate: {type: Date, default: '1/1/2019'}
})

interface IList extends mongoose.Document {
	id: string;
	name: string;
	endDate: Date;
	refreshedDate: Date;
}

const ListModel: mongoose.Model<IList> = mongoose.model<IList>('List', listSchema);

module.exports = {
		'Users': UserModel,
		'Friends': FriendModel,
		'Lists': ListModel
};