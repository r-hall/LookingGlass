// import rankFriends = require('./rankFriends');

// exports.handler = async (event: any) => {
//     // TODO implement
//     console.log('event', event);
//     let records = event['Records'];
//     let users = [];
//     let promiseArray = [];
//     for (let i = 0; i < records.length; i++) {
//         let messageArr = records[i]['body'].split('.');
//         let authenticatingUser = messageArr[0];
//         let user = messageArr[1];
//         users.push(user);
//         promiseArray.push(rankFriends(authenticatingUser, user));
//     }
//     await Promise.all(promiseArray);
//     return `done with users: ${users.join(', ')}`
// };