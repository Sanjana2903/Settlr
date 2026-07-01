import { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ScreenContainer } from '../components/ScreenContainer';
import { TextField } from '../components/TextField';
import { Button } from '../components/Button';
import { colors, spacing, typography } from '../theme/tokens';
import { useAuth } from '../context/AuthProvider';

export default function Verify() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { verifyOtp, sendOtp } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleVerify() {
    setError(null);
    if (code.trim().length !== 6) {
      setError('Enter the 6-digit code');
      return;
    }

    setLoading(true);
    const { error: verifyError } = await verifyOtp(email, code.trim());
    setLoading(false);

    if (verifyError) {
      setError(verifyError);
      return;
    }
    // On success, AuthProvider's session updates and RootNavigator redirects automatically.
  }

  async function handleResend() {
    setError(null);
    setResending(true);
    const { error: resendError } = await sendOtp(email);
    setResending(false);
    if (resendError) setError(resendError);
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>Check your email</Text>
      <Text style={styles.subtitle}>We sent a 6-digit code to {email}</Text>

      <TextField
        label="Verification code"
        placeholder="123456"
        keyboardType="number-pad"
        maxLength={6}
        value={code}
        onChangeText={setCode}
        error={error ?? undefined}
      />

      <Button label="Verify" onPress={handleVerify} loading={loading} />
      <Button
        label="Resend code"
        variant="secondary"
        onPress={handleResend}
        loading={resending}
      />
      <Button label="Use a different email" variant="secondary" onPress={() => router.back()} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text, marginTop: spacing.xxl },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.xl },
});
