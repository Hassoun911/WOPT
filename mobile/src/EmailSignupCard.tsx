import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import { detectPrayerLocation, type DetectedPrayerLocation } from "./deviceLocation";
import {
  getEmailBackendStatus,
  subscribeToPrayerEmails,
  type EmailAlertChoices
} from "./emailSignup";

type Props = {
  locale: "en" | "ar";
  onComplete: (summary: EmailSignupCompletion) => void;
};

export type EmailSignupCompletion = {
  email: string;
  location: string;
  timezone: string;
  timing: string;
  alreadySubscribed: boolean;
};

const COPY = {
  en: {
    eyebrow: "PRAYER EMAIL ALERTS",
    title: "Never miss a prayer",
    description: "Get email alerts for prayer times based automatically on your current location.",
    emailLabel: "Your email address",
    placeholder: "you@example.com",
    emailGood: "Email looks good",
    locationTitle: "Prayer location",
    locating: "Detecting your location…",
    locationDenied: "Allow location so Hassoun can select your local prayer times.",
    refresh: "Refresh",
    detected: "Detected automatically",
    timingTitle: "Notify me",
    twenty: "20 minutes before",
    twentyHint: "Early reminder",
    ten: "10 minutes before",
    tenHint: "Final reminder",
    athan: "At prayer time",
    athanHint: "When the prayer begins",
    privacy: "We use your location only to set local prayer times and your time zone. No continuous tracking.",
    subscribe: "Sign up for prayer emails",
    checking: "Checking email service…",
    unavailable: "Email service is temporarily unavailable. Please try again shortly.",
    creating: "Creating your prayer email subscription…",
    twentyShort: "20 min before",
    tenShort: "10 min before",
    athanShort: "At prayer time"
  },
  ar: {
    eyebrow: "تنبيهات الصلاة عبر البريد",
    title: "لا تفوّت أي صلاة",
    description: "استلم تنبيهات البريد حسب مواقيت الصلاة المحلية التي يحددها موقعك تلقائياً.",
    emailLabel: "بريدك الإلكتروني",
    placeholder: "you@example.com",
    emailGood: "البريد صحيح",
    locationTitle: "موقع الصلاة",
    locating: "جارٍ تحديد موقعك…",
    locationDenied: "اسمح بالموقع ليختار Hassoun مواقيت الصلاة المحلية.",
    refresh: "تحديث",
    detected: "تم تحديده تلقائياً",
    timingTitle: "نبّهني",
    twenty: "قبل الصلاة بـ٢٠ دقيقة",
    twentyHint: "تنبيه مبكر",
    ten: "قبل الصلاة بـ١٠ دقائق",
    tenHint: "التنبيه الأخير",
    athan: "عند دخول وقت الصلاة",
    athanHint: "عند بداية وقت الصلاة",
    privacy: "نستخدم موقعك فقط لتحديد مواقيت الصلاة والمنطقة الزمنية. لا توجد متابعة مستمرة للموقع.",
    subscribe: "الاشتراك بتنبيهات الصلاة",
    checking: "جارٍ التحقق من خدمة البريد…",
    unavailable: "خدمة البريد غير متاحة مؤقتاً. حاول مرة أخرى بعد قليل.",
    creating: "جارٍ إنشاء اشتراك تنبيهات الصلاة…",
    twentyShort: "قبل ٢٠ دقيقة",
    tenShort: "قبل ١٠ دقائق",
    athanShort: "عند وقت الصلاة"
  }
} as const;

function locationLabel(location: DetectedPrayerLocation | null) {
  if (!location) return "";
  return [location.city, location.region, location.countryName].filter(Boolean).join(", ") || location.timezone;
}

export default function EmailSignupCard({ locale, onComplete }: Props) {
  const copy = COPY[locale];
  const [email, setEmail] = useState("");
  const [choices, setChoices] = useState<EmailAlertChoices>({ twenty: false, ten: false, athan: true });
  const [checking, setChecking] = useState(true);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [location, setLocation] = useState<DetectedPrayerLocation | null>(null);
  const [locationBusy, setLocationBusy] = useState(true);
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    let mounted = true;
    void getEmailBackendStatus()
      .then((status) => {
        if (mounted) setAvailable(status.emailSignup === true && status.emailDeliveryConfigured === true);
      })
      .catch(() => {
        if (mounted) setAvailable(false);
      })
      .finally(() => {
        if (mounted) setChecking(false);
      });

    void detectPrayerLocation()
      .then((detected) => {
        if (!mounted) return;
        setLocation(detected);
        setLocationError(detected ? "" : copy.locationDenied);
      })
      .catch(() => {
        if (mounted) setLocationError(copy.locationDenied);
      })
      .finally(() => {
        if (mounted) setLocationBusy(false);
      });

    return () => { mounted = false; };
  }, [copy.locationDenied]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const anyTiming = choices.twenty || choices.ten || choices.athan;

  const timing = useMemo(() => {
    return [
      choices.twenty ? copy.twentyShort : null,
      choices.ten ? copy.tenShort : null,
      choices.athan ? copy.athanShort : null
    ].filter(Boolean).join(" • ");
  }, [choices, copy]);

  const setChoice = (key: keyof EmailAlertChoices, value: boolean) => {
    setChoices((current) => ({ ...current, [key]: value }));
  };

  const refreshLocation = async () => {
    if (locationBusy) return;
    setLocationBusy(true);
    setLocationError("");
    try {
      const detected = await detectPrayerLocation();
      setLocation(detected);
      if (!detected) setLocationError(copy.locationDenied);
    } catch {
      setLocationError(copy.locationDenied);
    } finally {
      setLocationBusy(false);
    }
  };

  const submit = async () => {
    if (!emailValid || !location || !anyTiming || busy || !available) return;
    setBusy(true);
    setError("");
    try {
      const { result, detectedLocation } = await subscribeToPrayerEmails(email, locale, choices, location);
      onComplete({
        email: email.trim(),
        location: locationLabel(detectedLocation),
        timezone: detectedLocation.timezone,
        timing,
        alreadySubscribed: result.alreadySubscribed === true
      });
    } catch (cause) {
      setError(String(cause instanceof Error ? cause.message : cause));
    } finally {
      setBusy(false);
    }
  };

  const choiceRow = (
    label: string,
    hint: string,
    key: keyof EmailAlertChoices,
    last = false
  ) => (
    <View style={[styles.choiceRow, last && styles.choiceRowLast]}>
      <View style={styles.choiceIcon}><Text style={styles.choiceIconText}>{key === "athan" ? "◖" : "◷"}</Text></View>
      <View style={styles.choiceCopy}>
        <Text style={styles.choiceText}>{label}</Text>
        <Text style={styles.choiceHint}>{hint}</Text>
      </View>
      <Switch
        value={choices[key]}
        onValueChange={(value) => setChoice(key, value)}
        disabled={busy}
        trackColor={{ false: "#d8d2c6", true: "#9cc8ba" }}
        thumbColor={choices[key] ? "#0b6a53" : "#fff"}
      />
    </View>
  );

  return (
    <View style={styles.card}>
      <View style={styles.decorativeRow}>
        <View style={styles.mosqueMark}><Text style={styles.mosqueMarkText}>و</Text></View>
        <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
      </View>

      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.description}>{copy.description}</Text>

      <Text style={styles.fieldLabel}>{copy.emailLabel}</Text>
      <View style={[styles.inputWrap, emailValid && styles.inputWrapValid]}>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder={copy.placeholder}
          placeholderTextColor="#9b968c"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          editable={!busy}
          style={styles.input}
        />
        <Text style={[styles.emailStatus, emailValid && styles.emailStatusValid]}>{emailValid ? "✓" : "✉"}</Text>
      </View>
      {emailValid ? <Text style={styles.emailGood}>✓ {copy.emailGood}</Text> : null}

      <Text style={styles.sectionTitle}>{copy.locationTitle}</Text>
      <View style={[styles.locationCard, !!location && styles.locationCardReady]}>
        <View style={styles.locationIconWrap}><Text style={styles.locationIcon}>⌖</Text></View>
        <View style={styles.locationCopy}>
          {locationBusy ? (
            <View style={styles.locationLoading}>
              <ActivityIndicator size="small" color="#0b6a53" />
              <Text style={styles.locationText}>{copy.locating}</Text>
            </View>
          ) : location ? (
            <>
              <Text style={styles.locationTitle}>{locationLabel(location)}</Text>
              <Text style={styles.locationText}>{location.timezone} • {copy.detected}</Text>
            </>
          ) : (
            <Text style={styles.locationError}>{locationError}</Text>
          )}
        </View>
        {!locationBusy ? (
          <Pressable onPress={() => void refreshLocation()} style={styles.refreshButton}>
            <Text style={styles.refreshText}>{location ? "↻" : copy.refresh}</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.sectionTitle}>{copy.timingTitle}</Text>
      <View style={styles.choiceList}>
        {choiceRow(copy.twenty, copy.twentyHint, "twenty")}
        {choiceRow(copy.ten, copy.tenHint, "ten")}
        {choiceRow(copy.athan, copy.athanHint, "athan", true)}
      </View>

      <View style={styles.privacyCard}>
        <Text style={styles.privacyIcon}>♢</Text>
        <Text style={styles.privacyText}>{copy.privacy}</Text>
      </View>

      {checking ? (
        <View style={styles.inlineStatus}>
          <ActivityIndicator size="small" color="#0b6a53" />
          <Text style={styles.statusText}>{copy.checking}</Text>
        </View>
      ) : !available ? (
        <Text style={styles.unavailable}>{copy.unavailable}</Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        onPress={submit}
        disabled={!available || busy || !emailValid || !location || !anyTiming}
        style={({ pressed }) => [
          styles.button,
          (!available || busy || !emailValid || !location || !anyTiming) && styles.buttonDisabled,
          pressed && available && !busy && styles.buttonPressed
        ]}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.buttonText}>{copy.subscribe}</Text>
            <Text style={styles.buttonArrow}>→</Text>
          </>
        )}
      </Pressable>
      {busy ? <Text style={styles.busyText}>{copy.creating}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: "#fffdf8",
    borderWidth: 1,
    borderColor: "#e3dac9",
    shadowColor: "#604f35",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3
  },
  decorativeRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  mosqueMark: { width: 30, height: 30, borderRadius: 10, backgroundColor: "#e7efe9", alignItems: "center", justifyContent: "center" },
  mosqueMarkText: { color: "#0b6a53", fontSize: 18, fontWeight: "900" },
  eyebrow: { color: "#7a6b53", fontSize: 10, fontWeight: "900", letterSpacing: 1.7 },
  title: { color: "#153f35", fontSize: 25, lineHeight: 30, fontWeight: "900", marginTop: 15 },
  description: { color: "#6f746c", fontSize: 13, lineHeight: 20, marginTop: 7 },
  fieldLabel: { color: "#3f524b", fontSize: 12, fontWeight: "900", marginTop: 22, marginBottom: 7 },
  inputWrap: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#d8cfbe",
    backgroundColor: "#fff",
    borderRadius: 15,
    paddingLeft: 14,
    paddingRight: 12
  },
  inputWrapValid: { borderColor: "#8bbcab", backgroundColor: "#fbfffd" },
  input: { flex: 1, minHeight: 54, fontSize: 16, color: "#173f35" },
  emailStatus: { color: "#9a8f7d", fontSize: 17, fontWeight: "900" },
  emailStatusValid: { color: "#0b7a5c" },
  emailGood: { color: "#0b7a5c", fontSize: 11, fontWeight: "800", marginTop: 6 },
  sectionTitle: { color: "#3f524b", fontSize: 12, fontWeight: "900", marginTop: 20, marginBottom: 8 },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2d8c7",
    backgroundColor: "#f8f3e9"
  },
  locationCardReady: { backgroundColor: "#f4f7ef", borderColor: "#d5e1d5" },
  locationIconWrap: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#e9e4d8", alignItems: "center", justifyContent: "center" },
  locationIcon: { color: "#0b6a53", fontSize: 21, fontWeight: "900" },
  locationCopy: { flex: 1 },
  locationLoading: { flexDirection: "row", alignItems: "center", gap: 8 },
  locationTitle: { color: "#214d42", fontSize: 13, fontWeight: "900" },
  locationText: { color: "#7d8179", fontSize: 11, lineHeight: 16, marginTop: 2 },
  locationError: { color: "#945244", fontSize: 11, lineHeight: 16 },
  refreshButton: { minWidth: 32, minHeight: 32, borderRadius: 10, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  refreshText: { color: "#0b6a53", fontSize: 16, fontWeight: "900" },
  choiceList: { borderWidth: 1, borderColor: "#e2d8c7", borderRadius: 17, overflow: "hidden", backgroundColor: "#fff" },
  choiceRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 13, borderBottomWidth: 1, borderBottomColor: "#eee8de" },
  choiceRowLast: { borderBottomWidth: 0 },
  choiceIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: "#f6f1e8", alignItems: "center", justifyContent: "center" },
  choiceIconText: { color: "#6e7c75", fontSize: 18 },
  choiceCopy: { flex: 1 },
  choiceText: { color: "#244d42", fontSize: 14, fontWeight: "800" },
  choiceHint: { color: "#979288", fontSize: 11, marginTop: 2 },
  privacyCard: { flexDirection: "row", alignItems: "flex-start", gap: 9, backgroundColor: "#f7f0e3", borderRadius: 14, padding: 12, marginTop: 14 },
  privacyIcon: { color: "#0b6a53", fontSize: 17, fontWeight: "900" },
  privacyText: { flex: 1, color: "#746e63", fontSize: 11, lineHeight: 17 },
  inlineStatus: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  statusText: { color: "#617871", fontSize: 12 },
  unavailable: { color: "#8a6b2d", backgroundColor: "#fff8e7", padding: 12, borderRadius: 12, fontSize: 12, lineHeight: 18, marginTop: 14 },
  error: { color: "#9c4035", backgroundColor: "#fff1ee", padding: 12, borderRadius: 12, fontSize: 12, lineHeight: 18, marginTop: 14 },
  button: { minHeight: 56, flexDirection: "row", gap: 10, borderRadius: 16, backgroundColor: "#0b5b47", alignItems: "center", justifyContent: "center", marginTop: 16, paddingHorizontal: 14 },
  buttonDisabled: { opacity: 0.38 },
  buttonPressed: { transform: [{ scale: 0.99 }], opacity: 0.94 },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "900", textAlign: "center" },
  buttonArrow: { color: "#fff", fontSize: 18, fontWeight: "700" },
  busyText: { color: "#617871", fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 9 }
});
