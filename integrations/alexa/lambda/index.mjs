const API_BASE = (process.env.HASSOUN_API_BASE || "https://wopt-prayer-push.wopt-windsor.workers.dev").replace(/\/$/, "");

function alexaResponse(text, shouldEndSession = true, reprompt = undefined, cardTitle = "Hassoun") {
  const response = {
    outputSpeech: { type: "PlainText", text },
    shouldEndSession
  };
  if (reprompt) response.reprompt = { outputSpeech: { type: "PlainText", text: reprompt } };
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
  try {
    return new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric" }).format(new Date(`${dateKey}T12:00:00Z`));
  } catch { return dateKey; }
}

export const handler = async (event) => {
  try {
    const request = event?.request || {};
    const requestType = request.type;

    if (requestType === "LaunchRequest") {
      return alexaResponse(
        "Assalamu alaikum. This is Hassoun. You can ask when Maghrib is, how long until Isha, what the next prayer is, today's prayer times, today's Hijri date, or the next Islamic event.",
        false,
        "Try asking, how long until Maghrib?"
      );
    }

    if (requestType === "SessionEndedRequest") return alexaResponse("", true);
    if (requestType !== "IntentRequest") return alexaResponse("I did not understand that request. Please ask Hassoun about prayer times or an Islamic date.", true);

    const intent = request.intent || {};
    const name = intent.name;

    if (name === "AMAZON.StopIntent" || name === "AMAZON.CancelIntent") return alexaResponse("Assalamu alaikum.", true);
    if (name === "AMAZON.HelpIntent") {
      return alexaResponse(
        "You can say, what time is Maghrib, how long until Fajr, what is the next prayer, give me today's prayer times, what is today's Hijri date, or what is the next Islamic holiday.",
        false,
        "Try asking, what is the next prayer?"
      );
    }
    if (name === "AMAZON.FallbackIntent") return alexaResponse("I can help with prayer times, countdowns, Hijri dates and Islamic events. Try asking when Maghrib is.", false, "When is Maghrib?");

    if (name === "NextPrayerIntent") {
      const data = await context();
      const next = data.nextPrayer;
      if (!next) return alexaResponse("I could not find the next prayer in the Hassoun schedule right now.");
      return alexaResponse(`The next prayer in ${data.location} is ${next.name} at ${next.displayTime}, in ${next.timeUntil}.`);
    }

    if (name === "PrayerTimeIntent") {
      const prayer = normalizePrayer(slotValue(intent, "PrayerName"));
      if (!prayer) return alexaResponse("Which prayer do you mean? You can say Fajr, Dhuhr, Asr, Maghrib or Isha.", false, "Which prayer?");
      const data = await context();
      const item = data.prayers?.[prayer];
      if (!item) return alexaResponse(`I could not find ${prayerName(prayer)} in today's Hassoun schedule.`);
      return alexaResponse(`${prayerName(prayer)} today in ${data.location} is at ${item.displayTime}.`);
    }

    if (name === "TimeUntilPrayerIntent") {
      const prayer = normalizePrayer(slotValue(intent, "PrayerName"));
      if (!prayer) return alexaResponse("Which prayer do you want the countdown for?", false, "For example, say Maghrib.");
      const data = await context(prayer);
      const item = data.requestedPrayer;
      if (!item) return alexaResponse(`I could not find the next ${prayerName(prayer)} in the Hassoun schedule.`);
      const when = item.isTomorrow ? `tomorrow at ${item.displayTime}` : `at ${item.displayTime}`;
      return alexaResponse(`${prayerName(prayer)} is ${when}, in ${item.timeUntil}.`);
    }

    if (name === "TodayPrayerTimesIntent") {
      const data = await context();
      const p = data.prayers;
      return alexaResponse(`Today's prayer times in ${data.location} are Fajr ${p.fajr.displayTime}, Dhuhr ${p.dhuhr.displayTime}, Asr ${p.asr.displayTime}, Maghrib ${p.maghrib.displayTime}, and Isha ${p.isha.displayTime}.`);
    }

    if (name === "NextIslamicEventIntent") {
      const data = await context();
      const event = data.nextIslamicEvent;
      if (!event) return alexaResponse("I could not find the next Islamic event right now.");
      const countdown = event.daysUntil === 0 ? "today" : event.daysUntil === 1 ? "tomorrow" : `in ${event.daysUntil} days`;
      return alexaResponse(`The next Islamic event is ${event.name}, ${countdown}, on ${dateSpeech(event.dateKey)}. The Hijri date is ${event.hijriDate}.`);
    }

    if (name === "IslamicDateIntent") {
      const data = await context();
      return alexaResponse(`Today's Hijri date in Hassoun is ${data.hijriDate}.`);
    }

    return alexaResponse("I can help with prayer times, countdowns, Hijri dates and Islamic events. Try asking when Maghrib is.", false, "When is Maghrib?");
  } catch (error) {
    console.error("Hassoun Alexa error", error);
    return alexaResponse("Hassoun could not reach the prayer schedule right now. Please try again in a moment.");
  }
};
