export const calculateDate = (daysFromToday: number) => {
    let currentDate = new Date();
    return currentDate.setDate(currentDate.getDate() + daysFromToday);
}