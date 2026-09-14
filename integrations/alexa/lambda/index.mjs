const API_BASE = (process.env.HASSOUN_API_BASE || "https://wopt-prayer-push.wopt-windsor.workers.dev").replace(/\/$/, "");
const PRAYER_KEYS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const WIDGET_NAMESPACE = "HassounPrayer";
const WIDGET_KEY = "main";
const REMINDER_PERMISSION = "alexa::alerts:reminders:skill:readwrite";

const HASSOUN_DASHBOARD = {
  type: "APL",
  version: "2024.3",
  theme: "light",
  mainTemplate: {
    parameters: ["hassounData"],
    items: [
      {
        type: "Frame",
        width: "100vw",
        height: "100vh",
        backgroundColor: "#F5F1E7",
        item: {
          type: "Container",
          width: "100%",
          height: "100%",
          paddingLeft: "34dp",
          paddingRight: "34dp",
          paddingTop: "22dp",
          paddingBottom: "22dp",
          items: [
            {
              type: "Container",
              direction: "row",
              width: "100%",
              height: "72dp",
              justifyContent: "spaceBetween",
              alignItems: "center",
              items: [
                {
                  type: "Container",
                  direction: "row",
                  alignItems: "center",
                  items: [
                    {
                      type: "Frame",
                      width: "56dp",
                      height: "56dp",
                      borderRadius: "28dp",
                      backgroundColor: "#0B6B58",
                      item: {
                        type: "Text",
                        text: "H",
                        width: "56dp",
                        height: "56dp",
                        textAlign: "center",
                        textAlignVertical: "center",
                        fontSize: "29dp",
                        fontWeight: 700,
                        color: "#FFFFFF"
                      }
                    },
                    {
                      type: "Container",
                      paddingLeft: "14dp",
                      items: [
                        { type: "Text", text: "HASSOUN", fontSize: "29dp", fontWeight: 700, color: "#0B5F4F" },
                        { type: "Text", text: "Prayer dashboard", fontSize: "15dp", color: "#6C837A" }
                      ]
                    }
                  ]
                },
                {
                  type: "Container",
                  alignItems: "end",
                  items: [
                    { type: "Text", text: "⌖  ${hassounData.location}", fontSize: "18dp", fontWeight: 700, color: "#173F37" },
                    { type: "Text", text: "${hassounData.dateLabel}", fontSize: "15dp", color: "#6C837A", paddingTop: "2dp" },
                    { type: "Text", text: "${hassounData.hijriDate}", fontSize: "15dp", fontWeight: 600, color: "#0B6B58", paddingTop: "1dp" }
                  ]
                }
              ]
            },
            {
              type: "Container",
              direction: "row",
              width: "100%",
              height: "430dp",
              marginTop: "14dp",
              items: [
                {
                  type: "Frame",
                  width: "66%",
                  height: "430dp",
                  borderRadius: "28dp",
                  backgroundColor: "#0B6B58",
                  item: {
                    type: "Container",
                    width: "100%",
                    height: "100%",
                    paddingLeft: "34dp",
                    paddingRight: "34dp",
                    paddingTop: "26dp",
                    paddingBottom: "24dp",
                    justifyContent: "center",
                    items: [
                      {
                        type: "Container",
                        direction: "row",
                        justifyContent: "spaceBetween",
                        alignItems: "center",
                        items: [
                          { type: "Text", text: "NEXT PRAYER", fontSize: "17dp", fontWeight: 700, color: "#D5EEE6", letterSpacing: 2 },
                          { type: "Text", text: "☾", fontSize: "44dp", color: "#D7C790" }
                        ]
                      },
                      { type: "Text", text: "${hassounData.nextPrayer.name}", fontSize: "70dp", fontWeight: 700, color: "#FFFFFF", paddingTop: "2dp" },
                      { type: "Text", text: "${hassounData.nextPrayer.displayTime}", fontSize: "35dp", fontWeight: 700, color: "#FFFFFF", paddingTop: "4dp" },
                      { type: "Text", text: "${hassounData.nextPrayer.timeUntil}", fontSize: "25dp", fontWeight: 600, color: "#D8EFE8", paddingTop: "5dp" },
                      { type: "Frame", width: "100%", height: "1dp", backgroundColor: "#6FA99A", marginTop: "18dp" },
                      {
                        type: "Container",
                        direction: "row",
                        justifyContent: "spaceBetween",
                        alignItems: "end",
                        paddingTop: "14dp",
                        items: [
                          {
                            type: "Container",
                            items: [
                              { type: "Text", text: "COUNTDOWN TO ADHAN", fontSize: "14dp", fontWeight: 700, color: "#BFE1D8", letterSpacing: 1 },
                              { type: "Text", text: "${hassounData.nextPrayer.timeUntil}", fontSize: "36dp", fontWeight: 700, color: "#FFFFFF", paddingTop: "4dp" }
                            ]
                          },
                          { type: "Text", text: "Closer to what matters.", fontSize: "15dp", fontStyle: "italic", color: "#DDEFE9", paddingBottom: "5dp" }
                        ]
                      }
                    ]
                  }
                },
                {
                  type: "Container",
                  width: "34%",
                  height: "430dp",
                  paddingLeft: "16dp",
                  items: [
                    {
                      type: "Frame",
                      width: "100%",
                      height: "166dp",
                      borderRadius: "22dp",
                      backgroundColor: "#FFFFFF",
                      item: {
                        type: "Container",
                        paddingLeft: "22dp",
                        paddingRight: "22dp",
                        paddingTop: "20dp",
                        paddingBottom: "18dp",
                        items: [
                          { type: "Text", text: "TODAY", fontSize: "15dp", fontWeight: 700, color: "#0B6B58", letterSpacing: 1 },
                          { type: "Text", text: "${hassounData.dateLabel}", fontSize: "24dp", fontWeight: 700, color: "#173F37", paddingTop: "8dp", maxLines: 2 },
                          { type: "Text", text: "${hassounData.hijriDate}", fontSize: "17dp", color: "#6C837A", paddingTop: "7dp", maxLines: 2 }
                        ]
                      }
                    },
                    {
                      type: "Frame",
                      width: "100%",
                      height: "248dp",
                      marginTop: "16dp",
                      borderRadius: "22dp",
                      backgroundColor: "#FFF7E5",
                      item: {
                        type: "Container",
                        paddingLeft: "22dp",
                        paddingRight: "22dp",
                        paddingTop: "22dp",
                        paddingBottom: "20dp",
                        justifyContent: "center",
                        items: [
                          { type: "Text", text: "NEXT ISLAMIC EVENT", fontSize: "14dp", fontWeight: 700, color: "#A26A00", letterSpacing: 1 },
                          { type: "Text", text: "${hassounData.eventName}", fontSize: "28dp", fontWeight: 700, color: "#4C3916", paddingTop: "10dp", maxLines: 2 },
                          { type: "Text", text: "${hassounData.eventWhen}", fontSize: "19dp", fontWeight: 600, color: "#7D6330", paddingTop: "9dp" },
                          { type: "Text", text: "☾", fontSize: "40dp", color: "#C99A32", paddingTop: "12dp" }
                        ]
                      }
                    }
                  ]
                }
              ]
            },
            {
              type: "Container",
              direction: "row",
              width: "100%",
              height: "112dp",
              justifyContent: "spaceBetween",
              marginTop: "16dp",
              items: [
                {
                  type: "Frame", width: "18.4%", height: "112dp", borderRadius: "18dp",
                  backgroundColor: "${hassounData.nextPrayer.prayer == 'fajr' ? '#0B6B58' : '#FFFFFF'}",
                  item: { type: "Container", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", items: [
                    { type: "Text", text: "FAJR", fontSize: "15dp", fontWeight: 700, color: "${hassounData.nextPrayer.prayer == 'fajr' ? '#D9EFE8' : '#6C837A'}" },
                    { type: "Text", text: "${hassounData.prayers.fajr.displayTime}", fontSize: "23dp", fontWeight: 700, color: "${hassounData.nextPrayer.prayer == 'fajr' ? '#FFFFFF' : '#173F37'}", paddingTop: "6dp" }
                  ] }
                },
                {
                  type: "Frame", width: "18.4%", height: "112dp", borderRadius: "18dp",
                  backgroundColor: "${hassounData.nextPrayer.prayer == 'dhuhr' ? '#0B6B58' : '#FFFFFF'}",
                  item: { type: "Container", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", items: [
                    { type: "Text", text: "DHUHR", fontSize: "15dp", fontWeight: 700, color: "${hassounData.nextPrayer.prayer == 'dhuhr' ? '#D9EFE8' : '#6C837A'}" },
                    { type: "Text", text: "${hassounData.prayers.dhuhr.displayTime}", fontSize: "23dp", fontWeight: 700, color: "${hassounData.nextPrayer.prayer == 'dhuhr' ? '#FFFFFF' : '#173F37'}", paddingTop: "6dp" }
                  ] }
                },
                {
                  type: "Frame", width: "18.4%", height: "112dp", borderRadius: "18dp",
                  backgroundColor: "${hassounData.nextPrayer.prayer == 'asr' ? '#0B6B58' : '#FFFFFF'}",
                  item: { type: "Container", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", items: [
                    { type: "Text", text: "ASR", fontSize: "15dp", fontWeight: 700, color: "${hassounData.nextPrayer.prayer == 'asr' ? '#D9EFE8' : '#6C837A'}" },
                    { type: "Text", text: "${hassounData.prayers.asr.displayTime}", fontSize: "23dp", fontWeight: 700, color: "${hassounData.nextPrayer.prayer == 'asr' ? '#FFFFFF' : '#173F37'}", paddingTop: "6dp" }
                  ] }
                },
                {
                  type: "Frame", width: "18.4%", height: "112dp", borderRadius: "18dp",
                  backgroundColor: "${hassounData.nextPrayer.prayer == 'maghrib' ? '#0B6B58' : '#FFFFFF'}",
                  item: { type: "Container", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", items: [
                    { type: "Text", text: "MAGHRIB", fontSize: "15dp", fontWeight: 700, color: "${hassounData.nextPrayer.prayer == 'maghrib' ? '#D9EFE8' : '#6C837A'}" },
                    { type: "Text", text: "${hassounData.prayers.maghrib.displayTime}", fontSize: "23dp", fontWeight: 700, color: "${hassounData.nextPrayer.prayer == 'maghrib' ? '#FFFFFF' : '#173F37'}", paddingTop: "6dp" }
                  ] }
                },
                {
                  type: "Frame", width: "18.4%", height: "112dp", borderRadius: "18dp",
                  backgroundColor: "${hassounData.nextPrayer.prayer == 'isha' ? '#0B6B58' : '#FFFFFF'}",
                  item: { type: "Container", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", items: [
                    { type: "Text", text: "ISHA", fontSize: "15dp", fontWeight: 700, color: "${hassounData.nextPrayer.prayer == 'isha' ? '#D9EFE8' : '#6C837A'}" },
                    { type: "Text", text: "${hassounData.prayers.isha.displayTime}", fontSize: "23dp", fontWeight: 700, color: "${hassounData.nextPrayer.prayer == 'isha' ? '#FFFFFF' : '#173F37'}", paddingTop: "6dp" }
                  ] }
                }
              ]
            }
          ]
        }
      }
    ]
  }
};

function supportsAPL(event) {
  return Boolean(event?.context?.System?.device?.supportedInterfaces?.["Alexa.Presentation.APL"]);
}

function alexaResponse(text = "", shouldEndSession = true, reprompt, directives = [], card) {
  const response = { shouldEndSession };
  if (text) response.outputSpeech = { type: "PlainText", text };
  if (reprompt) response.reprompt = { outputSpeech: { type: "PlainText", text: reprompt } };
  if (directives.length) response.directives = directives;
  if (card) response.card = card;
  return { version: "1.0", sessionAttributes: {}, response };
}

function slotValue(intent, name) {
  const slot = intent?.slots?.[name];
  const resolved = slot?.resolutions?.resolutionsPerAuthority?.[0]?.values?.[0]?.value?.name;
  return resolved || slot?.value || "";
}

function normalizePrayer(value) {
  const key = String(value || "").toLowerCase().replace(/[^a-z]/g, "");
  if (["fajr", "dhuhr", "asr", "maghrib", "isha"].includes(key)) return key;
  if (["fajar", "fajer", "fajir", "fajjar"].includes(key)) return "fajr";
  if (["zuhr", "dhur", "zuhur"].includes(key)) return "dhuhr";
  return "";
}

async function context(prayer = "") {
  const suffix = prayer ? `?prayer=${encodeURIComponent(prayer)}` : "";
  const response = await fetch(`${API_BASE}/voice/alexa/context${suffix}`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Hassoun API returned ${response.status}`);
  return response.json();
}

function prayerName(key) {
  return ({ fajr: "Fajr", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" })[key] || key;
}

function dateSpeech(dateKey) {
  try {
    return new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric" }).format(new Date(`${dateKey}T12:00:00Z`));
  } catch {
    return dateKey || "Today";
  }
}

function targetEpoch(item) {
  return Date.now() + Math.max(0, Number(item?.minutesUntil || 0)) * 60_000;
}

function dashboardData(data) {
  const next = data.nextPrayer || { name: "Prayer", prayer: "", displayTime: "--", minutesUntil: 0, timeUntil: "" };
  const prayers = data.prayers || {};
  return {
    location: data.location || "Windsor, Ontario",
    dateLabel: dateSpeech(data.dateKey),
    hijriDate: data.hijriDate || "",
    prayers: {
      fajr: prayers.fajr || { displayTime: "--" },
      dhuhr: prayers.dhuhr || { displayTime: "--" },
      asr: prayers.asr || { displayTime: "--" },
      maghrib: prayers.maghrib || { displayTime: "--" },
      isha: prayers.isha || { displayTime: "--" }
    },
    nextPrayer: {
      ...next,
      targetEpochMs: targetEpoch(next),
      timeUntil: next.timeUntil || `${Math.max(0, Number(next.minutesUntil || 0))} minutes`
    },
    eventName: data.nextIslamicEvent?.name || "Islamic calendar",
    eventWhen: data.nextIslamicEvent
      ? (data.nextIslamicEvent.daysUntil === 0 ? "Today" : data.nextIslamicEvent.daysUntil === 1 ? "Tomorrow" : `In ${data.nextIslamicEvent.daysUntil} days`)
      : "No upcoming event available"
  };
}

function dashboardDirective(data) {
  return {
    type: "Alexa.Presentation.APL.RenderDocument",
    token: `hassoun-dashboard-${Date.now()}`,
    document: HASSOUN_DASHBOARD,
    datasources: { hassounData: dashboardData(data) }
  };
}

async function upcomingWidgetData(baseData) {
  const requested = await Promise.all(PRAYER_KEYS.map(async (key) => {
    try {
      const d = await context(key);
      const item = d.requestedPrayer;
      return item ? { name: prayerName(key), displayTime: item.displayTime, targetEpochMs: targetEpoch(item) } : null;
    } catch {
      return null;
    }
  }));
  return {
    location: baseData.location,
    hijriDate: baseData.hijriDate,
    updatedAt: new Date().toISOString(),
    upcoming: requested.filter(Boolean).sort((a, b) => a.targetEpochMs - b.targetEpochMs)
  };
}

let cachedDatastoreToken = null;
let cachedDatastoreTokenExpiresAt = 0;
async function datastoreToken() {
  if (cachedDatastoreToken && Date.now() < cachedDatastoreTokenExpiresAt) return cachedDatastoreToken;
  const clientId = process.env.ALEXA_SKILL_CLIENT_ID;
  const clientSecret = process.env.ALEXA_SKILL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret, scope: "alexa::datastore" });
  const response = await fetch("https://api.amazon.com/auth/o2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body
  });
  if (!response.ok) throw new Error(`Alexa datastore token returned ${response.status}`);
  const json = await response.json();
  cachedDatastoreToken = json.access_token;
  cachedDatastoreTokenExpiresAt = Date.now() + Math.max(60, Number(json.expires_in || 3600) - 60) * 1000;
  return cachedDatastoreToken;
}

async function refreshWidget(event, baseData) {
  const userId = event?.context?.System?.user?.userId;
  const apiEndpoint = event?.context?.System?.apiEndpoint || "https://api.amazonalexa.com";
  if (!userId) return false;
  const token = await datastoreToken();
  if (!token) return false;
  const content = await upcomingWidgetData(baseData);
  const response = await fetch(`${apiEndpoint}/v1/datastore/commands`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      commands: [{ type: "PUT_OBJECT", namespace: WIDGET_NAMESPACE, key: WIDGET_KEY, content }],
      target: { type: "USER", id: userId },
      attemptDeliveryUntil: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
    })
  });
  if (!response.ok) throw new Error(`Alexa datastore update returned ${response.status}`);
  return true;
}

async function createReminder(event, scheduledTime, text, timezone) {
  const system = event?.context?.System;
  if (!system?.apiAccessToken) throw new Error("REMINDER_PERMISSION_REQUIRED");
  const response = await fetch(`${system.apiEndpoint || "https://api.amazonalexa.com"}/v1/alerts/reminders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${system.apiAccessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      requestTime: new Date().toISOString(),
      trigger: { type: "SCHEDULED_ABSOLUTE", scheduledTime, timeZoneId: timezone || "America/Toronto" },
      alertInfo: { spokenInfo: { content: [{ locale: "en-US", text }] } },
      pushNotification: { status: "ENABLED" }
    })
  });
  if (response.status === 401 || response.status === 403) throw new Error("REMINDER_PERMISSION_REQUIRED");
  if (!response.ok) throw new Error(`Alexa reminder returned ${response.status}`);
  return response.json();
}

async function setNextPrayerReminders(event, data) {
  const next = data.nextPrayer;
  if (!next) return 0;
  const minutes = Math.max(0, Number(next.minutesUntil || 0));
  const targets = [
    { before: 10, text: `${next.name} is in ten minutes.` },
    { before: 5, text: `${next.name} is in five minutes.` },
    { before: 0, text: `It is time for ${next.name}.` }
  ].filter((item) => minutes > item.before);
  let count = 0;
  for (const item of targets) {
    const delayMinutes = Math.max(1, minutes - item.before);
    await createReminder(event, new Date(Date.now() + delayMinutes * 60_000).toISOString(), item.text, data.timezone);
    count += 1;
  }
  return count;
}

async function dataAndVisual(event, speech, keepOpen = false) {
  const data = await context();
  refreshWidget(event, data).catch((error) => console.warn("Hassoun widget update skipped", error?.message || error));
  return alexaResponse(
    speech,
    !keepOpen,
    keepOpen ? "You can ask me about any prayer time." : undefined,
    supportsAPL(event) ? [dashboardDirective(data)] : []
  );
}

export const handler = async (event) => {
  try {
    const request = event?.request || {};
    const requestType = request.type;

    if (requestType === "Alexa.DataStore.PackageManager.UsagesInstalled" || requestType === "Alexa.DataStore.PackageManager.UpdateRequest") {
      const data = await context();
      await refreshWidget(event, data).catch((error) => console.warn("Widget initial sync failed", error?.message || error));
      return alexaResponse("", true);
    }
    if (requestType === "Alexa.DataStore.PackageManager.UsagesRemoved" || requestType === "Alexa.DataStore.PackageManager.InstallationError" || requestType === "Alexa.DataStore.Error") return alexaResponse("", true);
    if (requestType === "Alexa.Presentation.APL.UserEvent") return dataAndVisual(event, "Here is the Hassoun prayer dashboard.", true);
    if (requestType === "LaunchRequest") return dataAndVisual(event, "Assalamu alaikum. Here is today's Hassoun prayer dashboard.", true);
    if (requestType === "SessionEndedRequest") return alexaResponse("", true);
    if (requestType !== "IntentRequest") return alexaResponse("I did not understand that request. Please ask Hassoun about prayer times or an Islamic date.", true);

    const intent = request.intent || {};
    const name = intent.name;

    if (name === "AMAZON.StopIntent" || name === "AMAZON.CancelIntent") return alexaResponse("Assalamu alaikum.", true);
    if (name === "AMAZON.HelpIntent") return alexaResponse("You can ask for prayer times, countdowns, the Hijri date, the next Islamic event, show the prayer dashboard, or ask me to set reminders for the next prayer.", false, "Try asking, show the prayer dashboard.");
    if (name === "AMAZON.FallbackIntent") return alexaResponse("I can help with prayer times, countdowns, Hijri dates and Islamic events. Try asking when Maghrib is.", false, "When is Maghrib?");
    if (name === "ShowDashboardIntent") return dataAndVisual(event, "Here is the Hassoun prayer dashboard.", true);

    if (name === "SetNextPrayerAlertsIntent") {
      const data = await context();
      try {
        const count = await setNextPrayerReminders(event, data);
        return alexaResponse(
          count ? `Done. I set ${count} reminder${count === 1 ? "" : "s"} for ${data.nextPrayer.name}.` : "The next prayer is too close to set advance reminders.",
          false,
          "You can ask me another prayer question.",
          supportsAPL(event) ? [dashboardDirective(data)] : []
        );
      } catch (error) {
        if (error?.message === "REMINDER_PERMISSION_REQUIRED") {
          return alexaResponse("To create prayer reminders, please allow Hassoun to use Alexa Reminders in the Alexa app.", true, undefined, [], { type: "AskForPermissionsConsent", permissions: [REMINDER_PERMISSION] });
        }
        throw error;
      }
    }

    if (name === "NextPrayerIntent") {
      const data = await context();
      const next = data.nextPrayer;
      if (!next) return alexaResponse("I could not find the next prayer in the Hassoun schedule right now.");
      return alexaResponse(`The next prayer in ${data.location} is ${next.name} at ${next.displayTime}, in ${next.timeUntil}.`, true, undefined, supportsAPL(event) ? [dashboardDirective(data)] : []);
    }
    if (name === "PrayerTimeIntent") {
      const prayer = normalizePrayer(slotValue(intent, "PrayerName"));
      if (!prayer) return alexaResponse("Which prayer do you mean? You can say Fajr, Dhuhr, Asr, Maghrib or Isha.", false, "Which prayer?");
      const data = await context();
      const item = data.prayers?.[prayer];
      if (!item) return alexaResponse(`I could not find ${prayerName(prayer)} in today's Hassoun schedule.`);
      return alexaResponse(`${prayerName(prayer)} today in ${data.location} is at ${item.displayTime}.`, true, undefined, supportsAPL(event) ? [dashboardDirective(data)] : []);
    }
    if (name === "TimeUntilPrayerIntent") {
      const prayer = normalizePrayer(slotValue(intent, "PrayerName"));
      if (!prayer) return alexaResponse("Which prayer do you want the countdown for?", false, "For example, say Fajr.");
      const data = await context(prayer);
      const item = data.requestedPrayer;
      if (!item) return alexaResponse(`I could not find the next ${prayerName(prayer)} in the Hassoun schedule.`);
      const when = item.isTomorrow ? `tomorrow at ${item.displayTime}` : `at ${item.displayTime}`;
      return alexaResponse(`${prayerName(prayer)} is ${when}, in ${item.timeUntil}.`, true, undefined, supportsAPL(event) ? [dashboardDirective(data)] : []);
    }
    if (name === "TodayPrayerTimesIntent") {
      const data = await context();
      const p = data.prayers;
      return alexaResponse(`Today's prayer times in ${data.location} are Fajr ${p.fajr.displayTime}, Dhuhr ${p.dhuhr.displayTime}, Asr ${p.asr.displayTime}, Maghrib ${p.maghrib.displayTime}, and Isha ${p.isha.displayTime}.`, true, undefined, supportsAPL(event) ? [dashboardDirective(data)] : []);
    }
    if (name === "NextIslamicEventIntent") {
      const data = await context();
      const islamicEvent = data.nextIslamicEvent;
      if (!islamicEvent) return alexaResponse("I could not find the next Islamic event right now.");
      const countdown = islamicEvent.daysUntil === 0 ? "today" : islamicEvent.daysUntil === 1 ? "tomorrow" : `in ${islamicEvent.daysUntil} days`;
      return alexaResponse(`The next Islamic event is ${islamicEvent.name}, ${countdown}, on ${dateSpeech(islamicEvent.dateKey)}. The Hijri date is ${islamicEvent.hijriDate}.`, true, undefined, supportsAPL(event) ? [dashboardDirective(data)] : []);
    }
    if (name === "IslamicDateIntent") {
      const data = await context();
      return alexaResponse(`Today's Hijri date in Hassoun is ${data.hijriDate}.`, true, undefined, supportsAPL(event) ? [dashboardDirective(data)] : []);
    }

    return alexaResponse("I can help with prayer times, countdowns, Hijri dates and Islamic events. Try asking when Maghrib is.", false, "When is Maghrib?");
  } catch (error) {
    console.error("Hassoun Alexa error", error);
    return alexaResponse("Hassoun could not reach the prayer schedule right now. Please try again in a moment.");
  }
};