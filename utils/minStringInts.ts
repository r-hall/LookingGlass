// Return the minimum of two integers represented as strings.
export const minStringInts = (string1: string, string2: string) => {
    if (string1.length < string2.length) { return string1; };
    if (string2.length < string1.length) { return string2; };
    for (let i = 0; i < string1.length; i++) {
        let int1 = parseInt(string1[i]);
        let int2 = parseInt(string2[i]);
        if (int1 < int2) { return string1; };
        if (int2 < int1) { return string2; };
    }
    return string1;
}