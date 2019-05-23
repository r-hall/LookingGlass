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

module.exports = {
    'Users': UserModel
};
