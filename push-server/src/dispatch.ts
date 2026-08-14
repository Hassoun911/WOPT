import webpush from "web-push";
import { notificationMessage } from "./messages";
import type { DuePrayerEvent, Env, SubscriptionRow } from "./types";

const EXPO_URL = "https://exp.host/--/api/v2/push/send";

async function claimDelivery(env: Env, eventId: string, subscriptionId: number) {
  const result = await env.DB.prepare(
    "INSERT OR IGNORE INTO deliveries (event_id, subscription_id, status) VALUES (?, ?, 'pending')"
  ).bind(eventId, subscriptionId).run();
  return (result.meta.changes ?? 0) === 1;
}

async function releaseDelivery(env: Env, eventId: string, subscriptionId: number) {
  await env.DB.prepare(
    "DELETE FROM deliveries WHERE event_id = ? AND subscription_id = ? AND status = 'pending'"
  ).bind(eventId, subscriptionId).run();
}

async function completeDelivery(env: Env, eventId: string, subscriptionId: number, ticketId?: string) {
  await env.DB.prepare(
    "UPDATE deliveries SET status = 'sent', provider_ticket_id = ?, sent_at = CURRENT_TIMESTAMP WHERE event_id = ? AND subscription_id = ?"
  ).bind(ticketId ?? null, eventId, subscriptionId).run();
}

async function disableSubscription(env: Env, subscriptionId: number) {
  await env.DB.prepare(
    "UPDATE subscriptions SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(subscriptionId).run();
}

async function sendExpo(env: Env, subscription: SubscriptionRow, event: DuePrayerEvent) {
  const message = notificationMessage(event, subscription.locale);
  const response = await fetch(EXPO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {})
    },
    body: JSON.stringify({
      to: subscription.address,
      title: message.title,
      body: message.body,
      sound: subscription.platform === "ios" ? message.sound : "default",
      channelId: subscription.platform === "android" ? message.channelId : undefined,
      priority: "high",
      data: {
        eventId: event.id,
        dateKey: event.dateKey,
        prayer: event.prayer,
        kind: event.kind
      }
    })
  });
  if (!response.ok) throw new Error(`Expo push failed: ${response.status}`);
  const payload = (await response.json()) as {
    data?: { id?: string; status?: string; details?: { error?: string } };
  };
  if (payload.data?.details?.error === "DeviceNotRegistered") {
    await disableSubscription(env, subscription.id);
    return undefined;
  }
  if (payload.data?.status === "error") throw new Error("Expo rejected the notification");
  return payload.data?.id;
}

async function sendWeb(env: Env, subscription: SubscriptionRow, event: DuePrayerEvent) {
  if (!subscription.web_p256dh || !subscription.web_auth) throw new Error("Incomplete web subscription");
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  const message = notificationMessage(event, subscription.locale);
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.address,
        keys: { p256dh: subscription.web_p256dh, auth: subscription.web_auth }
      },
      JSON.stringify({
        ...message,
        eventId: event.id,
        dateKey: event.dateKey,
        prayer: event.prayer,
        kind: event.kind,
        url: "/"
      }),
      { TTL: 300, urgency: event.kind === "athan" ? "high" : "normal" }
    );
  } catch (error) {
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      await disableSubscription(env, subscription.id);
      return;
    }
    throw error;
  }
}

export async function dispatchEvent(env: Env, event: DuePrayerEvent) {
  const { results } = await env.DB.prepare(
    "SELECT id, installation_id, provider, platform, locale, address, web_p256dh, web_auth FROM subscriptions WHERE enabled = 1"
  ).all<SubscriptionRow>();

  for (const subscription of results) {
    if (!(await claimDelivery(env, event.id, subscription.id))) continue;
    try {
      let ticket: string | undefined;
      if (subscription.provider === "expo") {
        ticket = await sendExpo(env, subscription, event);
      } else {
        await sendWeb(env, subscription, event);
      }
      await completeDelivery(env, event.id, subscription.id, ticket);
    } catch (error) {
      await releaseDelivery(env, event.id, subscription.id);
      console.error("Push delivery failed", { eventId: event.id, subscriptionId: subscription.id, error });
    }
  }
}
