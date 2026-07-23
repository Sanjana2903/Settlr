import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { TextField } from '../../components/TextField';
import { Button } from '../../components/Button';
import { colors, spacing, typography } from '../../theme/tokens';
import { getMyProfile, updateMyProfile, type Profile } from '../../lib/profile';
import { isValidVpa } from '../../lib/upi';
import { getErrorMessage } from '../../lib/errors';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [upiVpa, setUpiVpa] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getMyProfile()
        .then((p) => {
          setProfile(p);
          setDisplayName(p.display_name ?? '');
          setUpiVpa(p.upi_vpa ?? '');
        })
        .catch((e) => setLoadError(getErrorMessage(e, 'Failed to load profile')));
    }, [])
  );

  async function handleSave() {
    setError(null);

    const trimmedVpa = upiVpa.trim();
    if (trimmedVpa.length > 0 && !isValidVpa(trimmedVpa)) {
      setError('That doesn’t look like a valid UPI ID (e.g. name@okhdfcbank)');
      return;
    }

    setSaving(true);
    try {
      await updateMyProfile({
        display_name: displayName.trim() || null,
        upi_vpa: trimmedVpa || null,
      });
      router.back();
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to save profile'));
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <ScreenContainer>
        <Text style={styles.error}>{loadError}</Text>
      </ScreenContainer>
    );
  }

  if (!profile) {
    return (
      <ScreenContainer>
        <ActivityIndicator style={styles.loading} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>Your profile</Text>

      <TextField label="Email" value={profile.email} editable={false} />
      <TextField
        label="Display name"
        placeholder="How others see you in groups"
        value={displayName}
        onChangeText={setDisplayName}
      />
      <TextField
        label="UPI ID"
        placeholder="name@okhdfcbank"
        autoCapitalize="none"
        value={upiVpa}
        onChangeText={setUpiVpa}
        error={error ?? undefined}
      />
      <Text style={styles.hint}>
        Used to build a payment link whenever someone in a group owes you money.
      </Text>

      <Button label="Save" onPress={handleSave} loading={saving} />
      <Button label="Cancel" variant="secondary" onPress={() => router.back()} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text, marginTop: spacing.xxl },
  hint: { ...typography.caption, color: colors.textMuted },
  error: { ...typography.body, color: colors.danger, marginTop: spacing.xxl },
  loading: { flex: 1 },
});
