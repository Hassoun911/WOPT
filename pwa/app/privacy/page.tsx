export const metadata = { title: "Privacy Policy • Hassoun" };

const card = { background: "#fffdf8", border: "1px solid #e4ded3", borderRadius: 20, padding: 20, marginBottom: 14 } as const;

export default function PrivacyPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f7f4ec", color: "#173f35", padding: "32px 16px 64px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <p style={{ color: "#0b7057", fontWeight: 800, letterSpacing: 1.5 }}>HASSOUN</p>
        <h1 style={{ fontSize: 38, margin: "8px 0" }}>Privacy Policy</h1>
        <p style={{ color: "#74817c", marginBottom: 24 }}>Updated September 14, 2026</p>
        <section style={card}><h2>Information Hassoun uses</h2><p>Depending on the features you choose, Hassoun may process location, push-notification tokens, prayer-email address and preferences, support-form contact details, Qur’an reading settings, bookmarks and memorization progress. Microphone access is requested only for recitation practice.</p></section>
        <section style={card}><h2>Alexa and voice-assistant profiles</h2><p>If you choose to link Alexa, Hassoun uses your email address for passwordless verification and stores the prayer locations you save for the voice profile. Alexa user and device identifiers are converted to one-way hashes before storage. These hashes let Hassoun remember which saved prayer location belongs to each linked Echo without storing the original Alexa identifiers. Account linking is optional; the core app can still be used without a Hassoun voice profile.</p></section>
        <section style={card}><h2>How information is used</h2><p>Information is used to provide prayer times and alerts, optional prayer-email reminders, Qur’an and memorization features, support, security, voice-assistant prayer answers, per-device prayer locations and service reliability. Hassoun does not sell personal information and does not use personal information for third-party advertising.</p></section>
        <section style={card}><h2>Permissions</h2><p>Location is used to select local prayer times and time zone. Notifications and exact alarms support reminders and native Adhan. Microphone access is used only when you start recitation practice. Hassoun uses the device’s speech-recognition service for that feature and does not intentionally upload or store raw microphone recordings on its own server.</p></section>
        <section style={card}><h2>Service providers</h2><p>Hassoun may rely on infrastructure and platform providers including Cloudflare, Amazon Alexa, Expo push services, Resend email delivery, Android speech recognition, and Qur’an/prayer-data providers. Only information needed for the selected feature is sent to those services.</p></section>
        <section style={card}><h2>Retention, deletion and choices</h2><p>Local settings remain until you change them, clear app data or uninstall. Prayer-email subscriptions remain until you unsubscribe. Voice-profile sessions and Alexa tokens expire and can be revoked; saved voice locations and linked-device records remain until removed or a deletion request is completed. Support messages may be retained as needed to answer and document the request. You can revoke operating-system permissions or unlink the Alexa skill at any time.</p></section>
        <section style={card}><h2>Accounts are optional</h2><p>The core Hassoun app does not require an account. Optional voice-assistant account linking uses passwordless email verification so you can save prayer locations and assign them to linked Echo devices.</p></section>
        <p style={{ color: "#6f7b76" }}>Privacy choices and support are available inside Hassoun under Settings &amp; Support.</p>
      </div>
    </main>
  );
}
