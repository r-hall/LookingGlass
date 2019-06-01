// Bound number of likes between 0 and 2000.
export const boundLikes = (numLikes: number): number => {
    if (numLikes < 0) {
        return 200;
    } else if (numLikes > 2000) {
        return 2000;
    } else {
        return numLikes;
    }
}