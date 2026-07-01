import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { colors, spacing, typography } from '../../theme/tokens';
import { useAuth } from '../../context/AuthProvider';
import { listMyGroups, type Group } from '../../lib/groups';
import { getErrorMessage } from '../../lib/errors';

export default function Home() {
  const { signOut } = useAuth();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadGroups = useCallback(() => {
    setError(null);
    listMyGroups()
      .then(setGroups)
      .catch((e) => setError(getErrorMessage(e, 'Failed to load groups')));
  }, []);

  useFocusEffect(loadGroups);

  return (
    <ScreenContainer>
      <Text style={styles.title}>Settlr</Text>

      <View style={styles.actions}>
        <Button label="New group" onPress={() => router.push('/groups/new')} />
        <Button
          label="Join with code"
          variant="secondary"
          onPress={() => router.push('/groups/join')}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {groups === null ? (
        <ActivityIndicator style={styles.loading} />
      ) : groups.length === 0 ? (
        <Text style={styles.placeholder}>
          No groups yet. Create one, or join with an invite code.
        </Text>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable onPress={() => router.push(`/groups/${item.id}`)}>
              <Card>
                <Text style={styles.groupName}>{item.name}</Text>
                <Text style={styles.groupMeta}>Invite code: {item.invite_code}</Text>
              </Card>
            </Pressable>
          )}
        />
      )}

      <Button label="Sign out" variant="secondary" onPress={signOut} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text, marginTop: spacing.xxl },
  actions: { flexDirection: 'row', gap: spacing.sm },
  error: { ...typography.body, color: colors.danger },
  loading: { flex: 1 },
  placeholder: { ...typography.body, color: colors.textMuted, flex: 1 },
  list: { flex: 1, gap: spacing.sm },
  groupName: { ...typography.heading, color: colors.text },
  groupMeta: { ...typography.caption, color: colors.textMuted },
});
