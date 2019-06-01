// Input: date when current scheduled builds will end, number of batches for current requested build.
// Output: new date when all scheduled builds, including new one, will end.
export const calculateNextDate = (dateUsed: Date, batches: number) => {
    const year = dateUsed.getUTCFullYear();
    const month = dateUsed.getUTCMonth();
    const day = dateUsed.getUTCDate();
    const hours = dateUsed.getUTCHours();
    const minutes = dateUsed.getUTCMinutes();
    const seconds = dateUsed.getUTCSeconds();
    const milliseconds = dateUsed.getUTCMilliseconds();
    return new Date(year, month, day + batches, hours, minutes, seconds, milliseconds);
}