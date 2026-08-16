import { useEffect, useState } from "react";
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
};

const COPY = {
  en: {
    title: "Prayer emails wherever you are",
    description: "Enter your email. WOPT will use your phone location automatically to send alerts using your local prayer times.",
    email: "Email address",
    location: "Location is detected automatically when you sign up.",
    twenty: "20 minutes before",
    ten: "10 minutes before",
    athan: "At prayer time",
    button: "Sign up for prayer emails",
    checking: "Checking email service…",
    unavailable: "Email delivery is being configured. The signup form will activate as soon as the mail service is connected.",
    locating: "Detecting location and signing up…",
    success: "Check your email to confirm your prayer alerts.",
    existing: "This email is already subscribed. Check your email for a secure manage link."
  },
  ar: {
    title: "تنبيهات الصلاة عبر البريد أينما كنت",
    description: "أدخل بريدك الإلكتروني. سيستخدم WOPT موقع هاتفك تلقائياً لإرسال التنبيهات حسب مواقيت الصلاة المحلية.",
    email: "البريد الإلكتروني",
    location: "يتم تحديد موقعك تلقائياً عند الاشتراك.",
    twenty: "قبل الصلاة بـ٢٠ دقيقة",
    ten: "قبل الصلاة بـ١٠ دقائق",
    athan: "عند دخول وقت الصلاة",
    button: "الاشتراك بتنبيهات الصلاة",
    checking: "جارٍ التحقق من خدمة البريد…",
    unavailable: "يتم تجهيز خدمة البريد حالياً. سيتم تفعيل الاشتراك فور ربط خدمة الإرسال.",
    locating: "جارٍ تحديد الموقع والاشتراك…",
    success: "تحقق من بريدك الإلكتروني لتأكيد تنبيهات الصلاة.",
    existing: "هذا البريد مشترك مسبقاً. تحقق من بريدك للحصول على رابط إدارة آمن."
  }
} as const;

export default function EmailSignupCard({ locale }: Props) {
  const copy = COPY[locale];
  const [email, setEmail] = useState("");
  const [choices, setChoices] = useState<EmailAlertChoices>({ twenty: false, ten: false, athan: true });
  const [checking, setChecking] = useState(true);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [locationLabel, setLocationLabel] = useState("");

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

  const setChoice = (key: keyof EmailAlertChoices, value: boolean) => {
    setChoices((current) => ({ ...current, [key]: value }));
  };

  const submit = async () => {
    if (!email.trim() || busy || !available) return;
    setBusy(true);
    setMessage("");
    try {
      const { result, detectedLocation } = await subscribeToPrayerEmails(email, locale, choices);
      const place = [detectedLocation.city, detectedLocation.region, detectedLocation.countryName]
        .filter(Boolean)
        .join(", ");
      setLocationLabel(place || detectedLocation.timezone);
      setMessage(result.alreadySubscribed ? copy.existing : copy.success);
    } catch (error) {
      setMessage(String(error instanceof Error ? error.message : error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.description}>{copy.description}</Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder={copy.email}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        editable={!busy}
        style={styles.input}
      />

      <Text style={styles.locationNote}>{copy.location}</Text>

      <View style={styles.choiceList}>
        <View style={styles.choiceRow}>
          <Text style={styles.choiceText}>{copy.twenty}</Text>
          <Switch value={choices.twenty} onValueChange={(value) => setChoice("twenty", value)} disabled={busy} />
        </View>
        <View style={styles.choiceRow}>
          <Text style={styles.choiceText}>{copy.ten}</Text>
          <Switch value={choices.ten} onValueChange={(value) => setChoice("ten", value)} disabled={busy} />
        </View>
        <View style={styles.choiceRow}>
          <Text style={styles.choiceText}>{copy.athan}</Text>
          <Switch value={choices.athan} onValueChange={(value) => setChoice("athan", value)} disabled={busy} />
        </View>
      </View>

      {checking ? (
        <View style={styles.inlineStatus}>
          <ActivityIndicator size="small" color="#0b5b47" />
          <Text style={styles.statusText}>{copy.checking}</Text>
        </View>
      ) : !available ? (
        <Text style={styles.unavailable}>{copy.unavailable}</Text>
      ) : null}

      <Pressable
        onPress={submit}
        disabled={!available || busy || !email.trim()}
        style={({ pressed }) => [
          styles.button,
          (!available || busy || !email.trim()) && styles.buttonDisabled,
          pressed && available && !busy && styles.buttonPressed
        ]}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{copy.button}</Text>}
      </Pressable>

      {busy ? <Text style={styles.statusText}>{copy.locating}</Text> : null}
      {locationLabel ? <Text style={styles.detected}>📍 {locationLabel}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 18,
    padding: 22,
    borderRadius: 26,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d7dfda"
  },
  title: { color: "#173f35", fontSize: 20, fontWeight: "900" },
  description: { color: "#617871", fontSize: 14, lineHeight: 21, marginTop: 6 },
  input: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: "#bfd4cd",
    backgroundColor: "#f7fbf9",
    borderRadius: 16,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 16,
    color: "#173f35"
  },
  locationNote: { marginTop: 9, color: "#6f827b", fontSize: 12 },
  choiceList: { marginTop: 16, gap: 8 },
  choiceRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#edf1ee"
  },
  choiceText: { flex: 1, color: "#244d42", fontSize: 14, fontWeight: "700" },
  inlineStatus: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
  statusText: { color: "#617871", fontSize: 12, marginTop: 10 },
  unavailable: { color: "#8a6b2d", backgroundColor: "#fff8e7", padding: 12, borderRadius: 12, fontSize: 12, lineHeight: 18, marginTop: 14 },
  button: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#0b5b47",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    paddingHorizontal: 14
  },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { opacity: 0.82 },
  buttonText: { color: "#fff", fontSize: 14, fontWeight: "900", textAlign: "center" },
  detected: { color: "#0b7a5c", fontSize: 12, fontWeight: "800", marginTop: 10 },
  message: { color: "#284d43", fontSize: 13, lineHeight: 19, marginTop: 10 }
});
