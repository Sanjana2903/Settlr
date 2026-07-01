import { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '../components/ScreenContainer';
import { TextField } from '../components/TextField';
import { Button } from '../components/Button';
import { colors, spacing, typography } from '../theme/tokens';
import { useAuth } from '../context/AuthProvider';

export default function SignIn() {
  const { sendOtp } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSendCode() {
    setError(null);
    const trimmed = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setError('Enter a valid email address');
      return;
    }

    setLoading(true);
    const { error: sendError } = await sendOtp(trimmed);
    setLoading(false);

    if (sendError) {
      setError(sendError);
      return;
    }

    router.push({ pathname: '/verify', params: { email: trimmed } });
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>Settlr</Text>
      <Text style={styles.subtitle}>Split. Pay. Done.</Text>

      <TextField
        label="Email"
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
        error={error ?? undefined}
      />

      <Button label="Send code" onPress={handleSendCode} loading={loading} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text, marginTop: spacing.xxl },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.xl },
});
