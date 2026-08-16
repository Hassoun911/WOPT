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
    eyebrow: "EMAIL ALERTS",
    title: "Prayer reminders that follow your location",
    description: "No account or password. Enter your email and choose when WOPT should contact you.",
    emailLabel: "Email address",
    placeholder: "name@example.com",
    locationTitle: "Automatic prayer location",
    locationBody: "Your phone location sets the correct local prayer times and time zone.",
    timingTitle: "Choose reminder timing",
    twenty: "20 minutes before",
    twentyHint: "Early reminder",
    ten: "10 minutes before",
    tenHint: "Final reminder",
    athan: "At prayer time",
    athanHint: "When the prayer begins",
    subscribe: "Subscribe to prayer emails",
    checking: "Checking email service…",
    unavailable: "Email service is temporarily unavailable. Please try again shortly.",
    locating: "Detecting your location and creating your subscription…",
    twentyShort: "20 min before",
    tenShort: "10 min before",
    athanShort: "At prayer time"
  },
  ar: {
    eyebrow: "تنبيهات البريد",
    title: "تنبيهات الصلاة التي تتبع موقعك",
    description: "لا تحتاج إلى حساب أو كلمة مرور. أدخل بريدك وحدد متى تريد استلام التنبيهات.",
    emailLabel: "البريد الإلكتروني",
    placeholder: "name@example.com",
    locationTitle: "موقع الصلاة تلقائياً",
    locationBody: "يحدد موقع هاتفك مواقيت الصلاة المحلية والمنطقة الزمنية الصحيحة.",
    timingTitle: "اختر توقيت التنبيه",
    twenty: "قبل الصلاة بـ٢٠ دقيقة",
    twentyHint: "تنبيه مبكر",
    ten: "قبل الصلاة بـ١٠ دقائق",
    tenHint: "التنبيه الأخير",
    athan: "عند دخول وقت الصلاة",
    athanHint: "عند بداية وقت الصلاة",
    subscribe: "الاشتراك بتنبيهات الصلاة",
    checking: "جارٍ التحقق من خدمة البريد…",
    unavailable: "خدمة البريد غير متاحة مؤقتاً. حاول مرة أخرى بعد قليل.",
    locating: "جارٍ تحديد موقعك وإنشاء الاشتراك…",
    twentyShort: "قبل ٢٠ دقيقة",
    tenShort: "قبل ١٠ دقائق",
    athanShort: "عند وقت الصلاة"
  }
} as const;

export default function EmailSignupCard({ locale, onComplete }: Props) {
  const copy = COPY[locale];
  const [email, setEmail] = useState("");
  const [choices, setChoices] = useState<EmailAlertChoices>({ twenty: false, ten: false, athan: true });
  const [checking, setChecking] = useState(true);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
    return () => { mounted = false; };
  }, []);

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

  const submit = async () => {
    if (!email.trim() || busy || !available) return;
    setBusy(true);
    setError("");
    try {
      const { result, detectedLocation } = await subscribeToPrayerEmails(email, locale, choices);
      const place = [detectedLocation.city, detectedLocation.region, detectedLocation.countryName]
        .filter(Boolean)
        .join(", ") || detectedLocation.timezone;

      onComplete({
        email: email.trim(),
        location: place,
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
      <View style={styles.choiceCopy}>
        <Text style={styles.choiceText}>{label}</Text>
        <Text style={styles.choiceHint}>{hint}</Text>
      </View>
      <Switch
        value={choices[key]}
        onValueChange={(value) => setChoice(key, value)}
        disabled={busy}
        trackColor={{ false: "#d8dfdc", true: "#8ebdaf" }}
        thumbColor={choices[key] ? "#0b5b47" : "#f8faf9"}
      />
    </View>
  );

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.description}>{copy.description}</Text>

      <Text style={styles.fieldLabel}>{copy.emailLabel}</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder={copy.placeholder}
        placeholderTextColor="#91a39d"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        editable={!busy}
        style={styles.input}
      />

      <View style={styles.locationCard}>
        <View style={styles.locationIconWrap}><Text style={styles.locationIcon}>⌖</Text></View>
        <View style={styles.locationCopy}>
          <Text style={styles.locationTitle}>{copy.locationTitle}</Text>
          <Text style={styles.locationText}>{copy.locationBody}</Text>
        </View>
        <Text style={styles.locationCheck}>✓</Text>
      </View>

      <Text style={styles.sectionTitle}>{copy.timingTitle}</Text>
      <View style={styles.choiceList}>
        {choiceRow(copy.twenty, copy.twentyHint, "twenty")}
        {choiceRow(copy.ten, copy.tenHint, "ten")}
        {choiceRow(copy.athan, copy.athanHint, "athan", true)}
      </View>

      {checking ? (
        <View style={styles.inlineStatus}>
          <ActivityIndicator size="small" color="#0b5b47" />
          <Text style={styles.statusText}>{copy.checking}</Text>
        </View>
      ) : !available ? (
        <Text style={styles.unavailable}>{copy.unavailable}</Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        onPress={submit}
        disabled={!available || busy || !email.trim()}
        style={({ pressed }) => [
          styles.button,
          (!available || busy || !email.trim()) && styles.buttonDisabled,
          pressed && available && !busy && styles.buttonPressed
        ]}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.buttonIcon}>✉</Text>
            <Text style={styles.buttonText}>{copy.subscribe}</Text>
          </>
        )}
      </Pressable>
      {busy ? <Text style={styles.busyText}>{copy.locating}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d8e1dd",
    shadowColor: "#173f35",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  },
  eyebrow: { color: "#17705b", fontSize: 10, fontWeight: "900", letterSpacing: 1.8 },
  title: { color: "#173f35", fontSize: 23, lineHeight: 28, fontWeight: "900", marginTop: 5 },
  description: { color: "#667b74", fontSize: 13, lineHeight: 20, marginTop: 7 },
  fieldLabel: { color: "#355c52", fontSize: 12, fontWeight: "900", marginTop: 20, marginBottom: 7 },
  input: {
    minHeight: 54,
    borderWidth: 1.5,
    borderColor: "#b8d0c8",
    backgroundColor: "#f7faf8",
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: "#173f35"
  },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginTop: 12,
    padding: 13,
    borderRadius: 16,
    backgroundColor: "#edf6f2"
  },
  locationIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#d9ebe4",
    alignItems: "center",
    justifyContent: "center"
  },
  locationIcon: { color: "#0b5b47", fontSize: 21, fontWeight: "900" },
  locationCopy: { flex: 1 },
  locationTitle: { color: "#174f40", fontSize: 13, fontWeight: "900" },
  locationText: { color: "#668078", fontSize: 11, lineHeight: 16, marginTop: 2 },
  locationCheck: { color: "#0b7a5c", fontSize: 17, fontWeight: "900" },
  sectionTitle: { color: "#355c52", fontSize: 12, fontWeight: "900", marginTop: 20, marginBottom: 8 },
  choiceList: {
    borderWidth: 1,
    borderColor: "#dce5e1",
    borderRadius: 17,
    overflow: "hidden",
    backgroundColor: "#fff"
  },
  choiceRow: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#edf1ef"
  },
  choiceRowLast: { borderBottomWidth: 0 },
  choiceCopy: { flex: 1 },
  choiceText: { color: "#244d42", fontSize: 14, fontWeight: "800" },
  choiceHint: { color: "#8a9a95", fontSize: 11, marginTop: 2 },
  inlineStatus: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  statusText: { color: "#617871", fontSize: 12 },
  unavailable: { color: "#8a6b2d", backgroundColor: "#fff8e7", padding: 12, borderRadius: 12, fontSize: 12, lineHeight: 18, marginTop: 14 },
  error: { color: "#9c4035", backgroundColor: "#fff1ee", padding: 12, borderRadius: 12, fontSize: 12, lineHeight: 18, marginTop: 14 },
  button: {
    minHeight: 56,
    flexDirection: "row",
    gap: 9,
    borderRadius: 16,
    backgroundColor: "#0b5b47",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    paddingHorizontal: 14
  },
  buttonDisabled: { opacity: 0.42 },
  buttonPressed: { transform: [{ scale: 0.99 }], opacity: 0.94 },
  buttonIcon: { color: "#fff", fontSize: 15, fontWeight: "900" },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "900", textAlign: "center" },
  busyText: { color: "#617871", fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 9 }
});
