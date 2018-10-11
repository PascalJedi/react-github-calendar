import {
  format,
  getDay,
  getMonth,
  isAfter,
  isSameYear,
  parse,
  setDay,
  subDays,
  subYears,
} from 'date-fns';

const API_URL = 'https://github-contributions-api.now.sh/v1/';
const DATE_FORMAT = 'YYYY-MM-DD';

function getContributionsForDate(data, date) {
  return data.contributions.find(contrib => contrib.date === date);
}

function getContributionCountForFullYear(data) {
  const { contributions } = data;
  const now = new Date();

  const begin = contributions.findIndex(
    contrib => contrib.date === format(now, DATE_FORMAT),
  );
  const end = contributions.findIndex(
    contrib => contrib.date === format(subYears(now, 1), DATE_FORMAT),
  );

  if (begin < 0 || end < 0) {
    return 0;
  }

  return contributions.slice(begin, end).reduce((acc, contrib) => acc + contrib.count, 0);
}

function getContributionCountForYear(data, year) {
  const yearEntry = data.years.find(entry => entry.year === String(year));

  return yearEntry ? yearEntry.total : 0;
}

function getBlocksForYear(year, data, fullYear) {
  const now = new Date();
  const firstDate = fullYear ? subYears(now, 1) : parse(`${year}-01-01`);
  const lastDate = fullYear ? now : parse(`${year}-12-31`);

  // The week starts on Sunday (day = 6)
  let weekStart;
  if (getDay(firstDate) !== 6) {
    weekStart = subDays(firstDate, getDay(firstDate));
  }

  // Fetch graph data for first row (Sundays)
  const firstRowDates = [];
  while (weekStart <= lastDate) {
    const date = format(weekStart, DATE_FORMAT);

    firstRowDates.push({
      date,
      info: getContributionsForDate(data, date),
    });

    weekStart = setDay(weekStart, 7);
  }

  // Add the remainig days per week (column for column)
  return firstRowDates.map((dateObj) => {
    const dates = [];
    for (let i = 0; i <= 6; i += 1) {
      const date = format(setDay(dateObj.date, i), DATE_FORMAT);

      if (isAfter(date, lastDate)) {
        break;
      }

      dates.push({
        date,
        info: getContributionsForDate(data, date),
      });
    }

    return dates;
  });
}

function getMonthLabels(blocks, fullYear) {
  let previousMonth = 0; // January
  const { length } = blocks;

  return blocks
    .slice(0, fullYear ? (length - 1) : length)
    .reduce((acc, week, x) => {
      const date = parse(week[0].date);
      const month = getMonth(date) + 1;
      const monthChanged = month !== previousMonth;
      const firstMonthIsDec = x === 0 && month === 12;

      if (monthChanged && !firstMonthIsDec) {
        acc.push({
          x,
          label: format(date, 'MMM'),
        });
        previousMonth = month;
      }

      return acc;
    }, []);
}

function getGraphDataForYear(year, data, fullYear) {
  const blocks = getBlocksForYear(year, data, fullYear);
  const monthLabels = getMonthLabels(blocks, fullYear);
  const totalCount = fullYear
    ? getContributionCountForFullYear(data)
    : getContributionCountForYear(data, year);

  return {
    year,
    blocks,
    monthLabels,
    totalCount,
  };
}

/**
 * Get the GitHub contributions for a specific user
 * @param options
 * @throws {Error} - Throws an error if the request fails or no data is available
 * @return {Promise<{blocks, monthLabels, totalCount}>} - A promise containing the data
 */
export async function getGitHubGraphData(options) {
  const { years, fullYear, username } = options;
  const data = await (await fetch(API_URL + username)).json();

  if (!data.years.length) {
    throw new Error('No data available');
  }

  return years.map((year) => {
    const isCurrentYear = isSameYear(parse(String(year)), new Date());

    return getGraphDataForYear(year, data, isCurrentYear && fullYear);
  });
}