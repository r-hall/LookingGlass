const minStringInts = require('./minStringInts').minStringInts;

// Return the minimum tweet id string from a set of tweets.
export const computeMinId = (tweets: any) => {
    let minStringInt: any;
    tweets.forEach(function(tweet: any) {
        if (!minStringInt) {
            minStringInt = tweet.id_str;
        } else {
            minStringInt = minStringInts(minStringInt, tweet.id_str);
        }
    });
    return minStringInt;
};