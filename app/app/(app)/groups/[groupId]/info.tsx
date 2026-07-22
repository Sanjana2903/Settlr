import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Share, StyleSheet, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '../../../../components/ScreenContainer';
import { Card } from '../../../../components/Card';
import { Button } from '../../../../components/Button';
import { colors, spacing, typography } from '../../../../theme/tokens';
import { getGroup, listGroupMembers, type Group, type GroupMember } from '../../../../lib/groups';
import { getErrorMessage } from '../../../../lib/errors';

export default function GroupInfo() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([getGroup(groupId), listGroupMembers(groupId)])
      .then(([groupData, memberData]) => {
        setGroup(groupData);
        setMembers(memberData);
      })
      .catch((e) => setError(getErrorMessage(e, 'Failed to load group')));
  }, [groupId]);

  useFocusEffect(load);

  async function handleShare() {
    if (!group) return;
    await Share.share({
      message: `Join "${group.name}" on Settlr! Use invite code: ${group.invite_code}`,
    });
  }

  if (error) {
    return (
      <ScreenContainer>
        <Text style={styles.error}>{error}</Text>
      </ScreenContainer>
    );
  }

  if (!group || !members) {
    return (
      <ScreenContainer>
        <ActivityIndicator style={styles.loading} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.title}>{group.name}</Text>

      <Card>
        <Text style={styles.cardLabel}>Invite code</Text>
        <Text style={styles.inviteCode}>{group.invite_code}</Text>
      </Card>

      <Button label="Share invite" variant="secondary" onPress={handleShare} />

      <Text style={styles.sectionLabel}>Members</Text>
      <FlatList
        data={members}
        keyExtractor={(item) => item.user_id}
        style={styles.list}
        renderItem={({ item }) => (
          <Text style={styles.memberRow}>
            {item.profile?.display_name || item.profile?.email || item.user_id}
          </Text>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text, marginTop: spacing.xxl },
  cardLabel: { ...typography.caption, color: colors.textMuted },
  inviteCode: { ...typography.heading, color: colors.text, letterSpacing: 2 },
  sectionLabel: { ...typography.heading, color: colors.text },
  list: { flexGrow: 0 },
  memberRow: { ...typography.body, color: colors.text, paddingVertical: spacing.xs },
  error: { ...typography.body, color: colors.danger, marginTop: spacing.xxl },
  loading: { flex: 1 },
});
