import fetch from "node-fetch";
import { runAppleScript } from "run-applescript";
import { getPreferenceValues, LocalStorage } from "@raycast/api";
import { formatDateTime } from "./formatDateTime";
import { Preferences } from "../types/preferencesTypes";
import { MatchItem } from "../types/matchTypes";

const sentNotificationsKey = "sentNotifications";

async function hasNotificationBeenSent(matchId: string) {
  const sentNotifications = JSON.parse((await LocalStorage.getItem(sentNotificationsKey)) || "{}");
  const today = new Date().toDateString();
  return sentNotifications[matchId] === today;
}

async function markNotificationAsSent(matchId: string) {
  const sentNotifications = JSON.parse((await LocalStorage.getItem(sentNotificationsKey)) || "{}");
  const today = new Date().toDateString();
  sentNotifications[matchId] = today;
  LocalStorage.setItem(sentNotificationsKey, JSON.stringify(sentNotifications));
}

function encodeRFC2047(string: string) {
  const encodedString = Buffer.from(string).toString("base64");
  return `=?UTF-8?B?${encodedString}?=`;
}

async function sendPushNotification(message: string, title: string, url: string) {
  const { ntfyTopic, ntfyToken } = getPreferenceValues<Preferences>();

  if (!ntfyTopic) {
    console.error("NTFY topic not set");
    return;
  }
  if (!ntfyToken) {
    console.error("NTFY token not set");
    return;
  }

  const encodedTitle = encodeRFC2047(title);
  const encodedTags = encodeRFC2047("soccer");

  try {
    await fetch("https://ntfy.sh/" + ntfyTopic, {
      method: "POST",
      body: message,
      headers: {
        Authorization: "Bearer " + ntfyToken,
        Title: encodedTitle,
        Click: url,
        Tags: encodedTags,
      },
    });
  } catch (error) {
    console.error("Failed to send notification:", error);
    return;
  }
}

export async function sendNotification(tournament: string, match: MatchItem) {
  if (!(await hasNotificationBeenSent(match.id))) {
    const message = `${tournament} - ${formatDateTime(new Date(match.status.utcTime))}`;
    const title = `${match.home.name} vs ${match.away.name}`;
    const url = match.matchLink;

    await runAppleScript(`display notification "${message}" with title "${title}" sound name "default"`);
    await sendPushNotification(message, title, url);
    await markNotificationAsSent(match.id);
  }
}
