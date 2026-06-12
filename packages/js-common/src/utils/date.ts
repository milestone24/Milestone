export const getDateUrlParams = (startDate?: Date, endDate?: Date) => {
  const encode = (date: Date) => encodeURIComponent(date.toISOString());

  return startDate && endDate
    ? `start=${encode(startDate)}&end=${encode(endDate)}`
    : startDate
      ? `start=${encode(startDate)}`
      : endDate
        ? `end=${encode(endDate)}`
        : `end=${encode(new Date())}`;
};
