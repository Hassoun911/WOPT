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
    parameters: ["payload"],
    items: [
      {
        type: "Container",
        width: "100vw",
        height: "100vh",
        paddingLeft: "4vw",
        paddingRight: "4vw",
        paddingTop: "3vh",
        paddingBottom: "3vh",
        backgroundColor: "#F7F4EC",
        items: [
          {
            type: "Container",
            direction: "row",
            alignItems: "center",
            justifyContent: "spaceBetween",
            width: "100%",
            items: [
              {
                type: "Container",
                direction: "row",
                alignItems: "center",
                items: [
                  { type: "Image", source: "https://hassoun.app/assets/hassoun-logo.png", width: "64dp", height: "64dp", scale: "best-fit" },
                  { type: "Text", text: "HASSOUN", fontSize: "34dp", fontWeight: "700", color: "#075C4D", paddingLeft: "16dp" }
                ]
              },
              {
                type: "Container",
                alignItems: "end",
                items: [
                  { type: "Text", text: "${payload.location}", fontSize: "20dp", color: "#315A52" },
                  { type: "Text", text: "${payload.hijriDate}", fontSize: "18dp", color: "#61766F" }
                ]
              }
            ]
          },
          {
            type: "Container",
            width: "100%",
            grow: 1,
            marginTop: "2vh",
            paddingLeft: "4vw",
            paddingRight: "4vw",
            paddingTop: "2.5vh",
            paddingBottom: "2.5vh",
            borderRadius: "28dp",
            backgroundColor: "${payload.nextPrayer.targetEpochMs - utcTime <= 300000 ? '#0B6B58' : '#0F765F'}",
            alignItems: "center",
            justifyContent: "center",
            items: [
              { type: "Text", text: "NEXT PRAYER", fontSize: "20dp", letterSpacing: 2, color: "#DFF3EC" },
              { type: "Text", text: "${payload.nextPrayer.name}", fontSize: "58dp", fontWeight: "700", color: "white", paddingTop: "4dp" },
              { type: "Text", text: "${payload.nextPrayer.displayTime}", fontSize: "30dp", color: "#E6F5F0" },
              {
                type: "Text",
                text: "${payload.nextPrayer.targetEpochMs <= utcTime ? 'IT IS TIME TO PRAY' : Time.format('HHH:mm:ss', payload.nextPrayer.targetEpochMs - utcTime)}",
                fontSize: "${payload.nextPrayer.targetEpochMs - utcTime <= 300000 ? '58dp' : '46dp'}",
                fontWeight: "700",
                color: "white",
                paddingTop: "10dp"
              },
              { type: "Text", text: "${payload.nextPrayer.targetEpochMs <= utcTime ? payload.nextPrayer.name : 'until Adhan'}", fontSize: "18dp", color: "#DFF3EC" }
            ]
          },
          {
            type: "Container",
            direction: "row",
            width: "100%",
            justifyContent: "spaceBetween",
            marginTop: "2vh",
            items: [
              { type: "Container", width: "18%", padding: "14dp", borderRadius: "18dp", backgroundColor: "white", alignItems: "center", items: [{type:"Text",text:"Fajr",fontSize:"20dp",fontWeight:"600",color:"#123D35"},{type:"Text",text:"${payload.prayers.fajr.displayTime}",fontSize:"22dp",color:"#0F765F"}] },
              { type: "Container", width: "18%", padding: "14dp", borderRadius: "18dp", backgroundColor: "white", alignItems: "center", items: [{type:"Text",text:"Dhuhr",fontSize:"20dp",fontWeight:"600",color:"#123D35"},{type:"Text",text:"${payload.prayers.dhuhr.displayTime}",fontSize:"22dp",color:"#0F765F"}] },
              { type: "Container", width: "18%", padding: "14dp", borderRadius: "18dp", backgroundColor: "white", alignItems: "center", items: [{type:"Text",text:"Asr",fontSize:"20dp",fontWeight:"600",color:"#123D35"},{type:"Text",text:"${payload.prayers.asr.displayTime}",fontSize:"22dp",color:"#0F765F"}] },
              { type: "Container", width: "18%", padding: "14dp", borderRadius: "18dp", backgroundColor: "white", alignItems: "center", items: [{type:"Text",text:"Maghrib",fontSize:"20dp",fontWeight:"600",color:"#123D35"},{type:"Text",text:"${payload.prayers.maghrib.displayTime}",fontSize:"22dp",color:"#0F765F"}] },
              { type: "Container", width: "18%", padding: "14dp", borderRadius: "18dp", backgroundColor: "white", alignItems: "center", items: [{type:"Text",text:"Isha",fontSize:"20dp",fontWeight:"600",color:"#123D35"},{type:"Text",text:"${payload.prayers.isha.displayTime}",fontSize:"22dp",color:"#0F765F"}] }
            ]
          },
          {
            type: "Container",
            direction: "row",
            width: "100%",
            justifyContent: "spaceBetween",
            marginTop: "2vh",
            items: [
              { type: "Text", text: "${payload.dateLabel}", fontSize: "18dp", color: "#536B64" },
              { type: "Text", text: "${payload.eventLabel}", fontSize: "18dp", color: "#536B64", textAlign: "right" }
            ]
          }
        ]
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
  return { version: "1.0", response, sessionAttributes: {} };
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
  return await response.json();
}

function prayerName(key) {
  return ({ fajr: "Fajr", dhuhr: "Dhuhr", asr: "Asr", maghrib: "Maghrib", isha: "Isha" })[key] || key;
}

function dateSpeech(dateKey) {
  try { return new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric" }).format(new Date(`${dateKey}T12:00:00Z`)); }
  catch { return dateKey; }
}

function targetEpoch(item) {
  return Date.now() + Math.max(0, Number(item?.minutesUntil || 0)) * 60_000;
}

function dashboardData(data) {
  const next = data.nextPrayer || { name: "Prayer", displayTime: "--", minutesUntil: 0 };
  return {
    location: data.location || "Windsor, Ontario",
    dateLabel: dateSpeech(data.dateKey),
    hijriDate: data.hijriDate || "",
    prayers: data.prayers || {},
    nextPrayer: { ...next, targetEpochMs: targetEpoch(next) },
    eventLabel: data.nextIslamicEvent ? `Next: ${data.nextIslamicEvent.name} • ${data.nextIslamicEvent.daysUntil === 0 ? "today" : data.nextIslamicEvent.daysUntil === 1 ? "tomorrow" : `in ${data.nextIslamicEvent.daysUntil} days`}` : ""
  };
}

function dashboardDirective(data) {
  return {
    type: "Alexa.Presentation.APL.RenderDocument",
    token: `hassoun-dashboard-${Date.now()}`,
    document: HASSOUN_DASHBOARD,
    datasources: { payload: dashboardData(data) }
  };
}

async function upcomingWidgetData(baseData) {
  const requested = await Promise.all(PRAYER_KEYS.map(async (key) => {
    try {
      const d = await context(key);
      const item = d.requestedPrayer;
      return item ? { name: prayerName(key), displayTime: item.displayTime, targetEpochMs: targetEpoch(item) } : null;
    } catch { return null; }
  }));
  const upcoming = requested.filter(Boolean).sort((a, b) => a.targetEpochMs - b.targetEpochMs);
  return {
    location: baseData.location,
    hijriDate: baseData.hijriDate,
    updatedAt: new Date().toISOString(),
    upcoming
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
  const response = await fetch("https://api.amazon.com/auth/o2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }, body });
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
  ].filter((x) => minutes > x.before);
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
  const directives = supportsAPL(event) ? [dashboardDirective(data)] : [];
  return alexaResponse(speech, !keepOpen, keepOpen ? "You can ask me about any prayer time." : undefined, directives);
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
    if (requestType === "Alexa.DataStore.PackageManager.UsagesRemoved" || requestType === "Alexa.DataStore.PackageManager.InstallationError" || requestType === "Alexa.DataStore.Error") {
      return alexaResponse("", true);
    }
    if (requestType === "Alexa.Presentation.APL.UserEvent") {
      return dataAndVisual(event, "Here is the Hassoun prayer dashboard.", true);
    }
    if (requestType === "LaunchRequest") {
      return dataAndVisual(event, "Assalamu alaikum. Here is today's Hassoun prayer dashboard.", true);
    }
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
        const directives = supportsAPL(event) ? [dashboardDirective(data)] : [];
        return alexaResponse(count ? `Done. I set ${count} reminder${count === 1 ? "" : "s"} for ${data.nextPrayer.name}.` : `The next prayer is too close to set advance reminders.`, false, "You can ask me another prayer question.", directives);
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
      const directives = supportsAPL(event) ? [dashboardDirective(data)] : [];
      return alexaResponse(`The next prayer in ${data.location} is ${next.name} at ${next.displayTime}, in ${next.timeUntil}.`, true, undefined, directives);
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
      const data = await context(); const p = data.prayers;
      return alexaResponse(`Today's prayer times in ${data.location} are Fajr ${p.fajr.displayTime}, Dhuhr ${p.dhuhr.displayTime}, Asr ${p.asr.displayTime}, Maghrib ${p.maghrib.displayTime}, and Isha ${p.isha.displayTime}.`, true, undefined, supportsAPL(event) ? [dashboardDirective(data)] : []);
    }
    if (name === "NextIslamicEventIntent") {
      const data = await context(); const islamicEvent = data.nextIslamicEvent;
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
