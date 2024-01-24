import { getPreferenceValues } from "@raycast/api";
import { MatchData, MatchItem, TeamDetailData } from "./types/matchTypes";
import { Preferences } from "./types/preferencesTypes";
import { fetchTeamDetail } from "./fetchTeamDetail";

export type Data = TeamDetailData & {
  calculated: {
    upcomingMatch: MatchItem | null;
    lastMatches: MatchItem[];
    nextMatches: MatchItem[];
  };
};

export async function fetchLeagueMatches(): Promise<MatchData> {
  const preferences = getPreferenceValues<Preferences>();
  const interestedTeams = getInterestedTeams(preferences);
  const startDateOffset = Number(preferences.startDateOffset) || 7;
  const endDateOffset = Number(preferences.endDateOffset) || 30;
  const currentDate = new Date();
  const startDate = new Date();
  startDate.setDate(currentDate.getDate() - startDateOffset);
  const endDate = new Date();
  endDate.setDate(currentDate.getDate() + endDateOffset);
  const allMatches: MatchData = [];

  for (const teamId of interestedTeams) {
    console.log(`Fetching matches for team ${teamId}`);
    const teamFixture = await fetchTeamFixture(teamId);

    if (teamFixture.data && teamFixture.data.calculated) {
      const { previousMatches, nextMatches } = teamFixture.data.calculated;

      const teamMatches: MatchItem[] = [];
      if (Array.isArray(previousMatches)) {
        teamMatches.push(...previousMatches);
      }
      if (Array.isArray(nextMatches)) {
        teamMatches.push(...nextMatches);
      }

      const processedMatches = teamMatches
        .filter((match: MatchItem) => isValidMatch(match, startDate, endDate))
        .map(processMatchData);
      allMatches.push(...processedMatches);
    }
  }
  return allMatches;
}

function isValidMatch(match: MatchItem, startDate: Date, endDate: Date) {
  const matchDate = new Date(match.status?.utcTime || Date.now());
  return matchDate >= startDate && matchDate <= endDate;
}

function getInterestedTeams(preferences: Preferences): number[] {
  const interestedTeams: number[] = [];

  for (let i = 1; i <= 5; i++) {
    const teamId = Number(preferences[`team${i}` as keyof Preferences]);
    if (teamId && !isNaN(teamId)) {
      interestedTeams.push(teamId);
    }
  }

  return interestedTeams;
}

function processMatchData(match: MatchItem) {
  const isMatchCompleted = match.status?.finished ?? false;
  const winningTeam = isMatchCompleted ? determineWinningTeam(match) : "";

  const date = new Date(match.status?.utcTime ?? new Date());
  const id = match.id;
  const tournament = {
    leagueId: match.tournament?.leagueId,
    name: match.tournament?.name ?? "",
  };
  const away = {
    id: match.away?.id ?? "",
    name: match.away?.name ?? "",
    score: match.away?.score,
  };
  const home = {
    id: match.home?.id ?? "",
    name: match.home?.name ?? "",
    score: match.home?.score,
  };
  const status = {
    utcTime: match.status?.utcTime ?? new Date(),
    started: match.status?.started ?? false,
    cancelled: match.status?.cancelled ?? false,
    finished: isMatchCompleted,
    ongoing: match.status?.ongoing ?? false,
  };
  const result = match.result;
  const pageUrl = match.pageUrl;
  const matchLink = `https://www.fotmob.com${pageUrl}`;

  return {
    date,
    id,
    away,
    home,
    status,
    result,
    pageUrl,
    matchLink,
    tournament,
    winner: winningTeam,
  };
}

function determineWinningTeam(match: MatchItem) {
  const homeScore = match.home?.score || 0;
  const awayScore = match.away?.score || 0;

  if (homeScore > awayScore) {
    return match.home?.name || "";
  }
  if (homeScore < awayScore) {
    return match.away?.name || "";
  }
  if (homeScore === awayScore) {
    return "draw";
  }

  return "";
}

async function fetchTeamFixture(teamId: number) {
  const { data, error, isLoading } = await fetchTeamDetail(teamId);

  if (data == null || error != null || isLoading) {
    return {
      data: {
        calculated: {
          upcomingMatch: null,
          ongoingMatch: null,
          previousMatches: [],
          nextMatches: [],
        },
      },
      error,
      isLoading,
    };
  }

  const allFixtures = data.fixtures.allFixtures;
  const fixtures = allFixtures.fixtures;
  const nextMatch = allFixtures.nextMatch;
  const ongoingMatch = nextMatch?.status.ongoing ? nextMatch : null;
  const nextMatchIndex = fixtures.findIndex((fixture) => fixture.id === nextMatch?.id);
  const previousMatches = fixtures.slice(0, nextMatchIndex);
  const nextMatches = ongoingMatch ? fixtures.slice(nextMatchIndex + 1) : fixtures.slice(nextMatchIndex);

  return {
    data: {
      ...data,
      calculated: {
        upcomingMatch: nextMatch,
        ongoingMatch,
        previousMatches,
        nextMatches,
      },
    },
    error,
    isLoading,
  };
}
