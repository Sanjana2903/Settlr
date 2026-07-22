import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Share, StyleSheet, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '../../../../components/ScreenContainer';
import { Card } from '../../../../components/Card';
import { Button } from '../../../../components/Button';
import { colors, spacing, typography } from '../../../../theme/tokens';
import { useAuth } from '../../../../context/AuthProvider';
import { getGroup, listGroupMembers, type Group, type GroupMember } from '../../../../lib/groups';
import { listExpenses, type Expense } from '../../../../lib/expenses';
import { getErrorMessage } from '../../../../lib/errors';

function memberName(member: GroupMember | undefined, fallbackId: string) {
  return member?.profile?.display_name || member?.profile?.email || fallbackId;
}

export default function GroupDetail() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { session } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[] | null>(null);
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([getGroup(groupId), listGroupMembers(groupId), listExpenses(groupId)])
      .then(([groupData, memberData, expenseData]) => {
        setGroup(groupData);
        setMembers(memberData);
        setExpenses(expenseData);
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

  if (!group || !members || !expenses) {
    return (
      <ScreenContainer>
        <ActivityIndicator style={styles.loading} />
      </ScreenContainer>
    );
  }

  const membersById = new Map(members.map((m) => [m.user_id, m]));

  return (
    <ScreenContainer>
      <Text style={styles.title}>{group.name}</Text>

      <Card>
        <Text style={styles.cardLabel}>Invite code</Text>
        <Text style={styles.inviteCode}>{group.invite_code}</Text>
      </Card>

      <Text style={styles.membersLine}>
        {members.map((m) => memberName(m, m.user_id)).join(', ')}
      </Text>

      <Button label="Share invite" variant="secondary" onPress={handleShare} />
      <Button label="Add expense" onPress={() => router.push(`/groups/${groupId}/expenses/new`)} />

      <Text style={styles.sectionLabel}>Expenses</Text>
      {expenses.length === 0 ? (
        <Text style={styles.placeholder}>No expenses yet.</Text>
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(item) => item.id}
          style={styles.list}
          renderItem={({ item }) => {
            const payer = membersById.get(item.paid_by);
            const isYou = item.paid_by === session?.user.id;
            return (
              <Card style={styles.expenseCard}>
                <Text style={styles.expenseDescription}>{item.description}</Text>
                <Text style={styles.expenseMeta}>
                  ₹{item.amount.toFixed(2)} · paid by {isYou ? 'you' : memberName(payer, item.paid_by)}
                </Text>
              </Card>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text, marginTop: spacing.xxl },
  cardLabel: { ...typography.caption, color: colors.textMuted },
  membersLine: { ...typography.caption, color: colors.textMuted },
  inviteCode: { ...typography.heading, color: colors.text, letterSpacing: 2 },
  sectionLabel: { ...typography.heading, color: colors.text },
  list: { flex: 1 },
  expenseCard: { marginBottom: spacing.sm },
  expenseDescription: { ...typography.body, color: colors.text, fontWeight: '600' },
  expenseMeta: { ...typography.caption, color: colors.textMuted },
  placeholder: { ...typography.body, color: colors.textMuted, flex: 1 },
  error: { ...typography.body, color: colors.danger, marginTop: spacing.xxl },
  loading: { flex: 1 },
});
