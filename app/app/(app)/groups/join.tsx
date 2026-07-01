import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { TextField } from '../../../components/TextField';
import { Button } from '../../../components/Button';
import { colors, spacing, typography } from '../../../theme/tokens';
import { joinGroupByInviteCode } from '../../../lib/groups';

export default function JoinGroup() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    setError(null);
    const trimmed = code.trim();
    if (trimmed.length === 0) {
      setError('Enter an invite code');
      return;
    }

    setLoading(true);
    try {
      const group = await joinGroupByInviteCode(trimmed);
      router.replace(`/groups/${group.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join group');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>Join a group</Text>

      <TextField
        label="Invite code"
        placeholder="e.g. a1b2c3d4"
        autoCapitalize="none"
        value={code}
        onChangeText={setCode}
        error={error ?? undefined}
      />

      <Button label="Join group" onPress={handleJoin} loading={loading} />
      <Button label="Cancel" variant="secondary" onPress={() => router.back()} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text, marginTop: spacing.xxl },
});
