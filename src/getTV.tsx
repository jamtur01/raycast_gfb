import fetch from "node-fetch";
import moment from "moment-timezone";
import * as cheerio from "cheerio";
import cityTimezones from "city-timezones";

moment.tz.setDefault("America/New_York");

const baseUrl = "https://www.livesoccertv.com/teams";

interface Match {
  live: boolean;
  played: boolean;
  competition: string;
  date: string;
  time: string;
  game: string;
  tvs: string[];
}

const splitTimezone = (tz: string): string[] => tz.split("/");
const urlifyTimezone = (tz: string): string => tz.replace("/", "%2F");

const getCountry = (city: string, tz: string) => {
  const cities = cityTimezones.lookupViaCity(city.replace("_", " "));
  return cities.find((c) => c.timezone === tz) || cities[0];
};

const badCountryCodes: Record<string, string> = {
  ESP: "ES",
  USA: "US",
  GBR: "UK",
  RUS: "RU",
};

const badLangCodes: Record<string, string> = {
  us: "en",
  gb: "en",
};

const fixCountryCode = (country: string): string => {
  return badCountryCodes[country] || country;
};

const fixLangCode = (lang: string): string => {
  return badLangCodes[lang] || lang;
};

const getTeamUrl = (country: string, team: string): string => `${baseUrl}/${country}/${team}`;

const adjustLocalTime = (time: string, timezone: string): string => {
  const resultDate = moment(time, "hh:mm").tz(timezone).format("LT");
  return resultDate !== "Invalid date" ? resultDate : time;
};

const getBody = async (country: string, team: string, timezone: string): Promise<string> => {
  const url = getTeamUrl(country, team);
  const [continent, city] = splitTimezone(timezone);
  let { iso3: countryCode, iso2: lang } = getCountry(city, timezone);
  lang = lang.toLowerCase();
  lang = fixLangCode(lang);
  countryCode = fixCountryCode(countryCode);
  const locale = `${lang}_${countryCode}`;

  const cookie = `live=live; u_scores=on; u_continent=${continent}; u_country=${country}; u_country_code=${countryCode}; u_timezone=${urlifyTimezone(
    timezone,
  )}; u_lang=${lang}; u_locale=${locale}`;
  const headers = {
    cookie,
    "user-agent":
      "Mozilla/6.0 (Macintosh; Intel Mac OS X 10_16_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36",
  };

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  const data = await response.text();
  return data;
};

const parseMatchesFromHtml = (body: string, timezone: string = "America/New_York"): Match[] => {
  const $ = cheerio.load(body);
  const matchRows: cheerio.Cheerio = $("tr.matchrow");
  const parsedMatches: Match[] = [];

  matchRows.each((i: number, el: cheerio.Element) => {
    const $el = $(el);
    const live: boolean = $el.find(".livecell").text().trim() === "Live";
    const played: boolean = $el.find(".livecell").hasClass("ft");
    const date: string = $el.prevAll(".drow").first().find("td.dcell > a").first().text();
    const competition: string = $el.prevAll(".drow").first().find("td.dcell > a").last().text();
    const time: string = $el.find(".timecell > span").text();
    const teamsAndScore: string = $el.find("td[id='match'] > a").text();
    const game: string = teamsAndScore.split("<score>")[0].trim();
    const tvs: string[] = $el
      .find("td[id='channels'] .mchannels a")
      .map((j: number, elem: cheerio.Element) => $(elem).attr("title"))
      .get();

    parsedMatches.push({
      live,
      played,
      competition,
      date,
      time: adjustLocalTime(time, timezone),
      game,
      tvs,
    });
  });

  console.log(parsedMatches);
  return parsedMatches;
};

export const getMatches = async (
  country: string,
  team: string,
  options: { timezone?: string } = {},
): Promise<Match[]> => {
  const timezone = options.timezone || "America/New_York";
  const body = await getBody(country, team, timezone);
  return parseMatchesFromHtml(body, timezone);
};
