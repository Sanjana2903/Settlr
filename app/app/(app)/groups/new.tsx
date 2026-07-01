import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { ScreenContainer } from '../../../components/ScreenContainer';
import { TextField } from '../../../components/TextField';
import { Button } from '../../../components/Button';
import { colors, spacing, typography } from '../../../theme/tokens';
import { createGroup } from '../../../lib/groups';
import { getErrorMessage } from '../../../lib/errors';

export default function NewGroup() {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    setError(null);
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError('Give your group a name');
      return;
    }

    setLoading(true);
    try {
      const group = await createGroup(trimmed);
      router.replace(`/groups/${group.id}`);
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to create group'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>New group</Text>

      <TextField
        label="Group name"
        placeholder="Goa Trip, Flat 3B, ..."
        value={name}
        onChangeText={setName}
        error={error ?? undefined}
      />

      <Button label="Create group" onPress={handleCreate} loading={loading} />
      <Button label="Cancel" variant="secondary" onPress={() => router.back()} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text, marginTop: spacing.xxl },
});
