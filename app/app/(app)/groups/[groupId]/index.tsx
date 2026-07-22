import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Share, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '../../../../components/ScreenContainer';
import { Card } from '../../../../components/Card';
import { Button } from '../../../../components/Button';
import { colors, spacing, typography } from '../../../../theme/tokens';
import { useAuth } from '../../../../context/AuthProvider';
import { getGroup, listGroupMembers, type Group, type GroupMember } from '../../../../lib/groups';
import { listExpenses, listExpenseSplits, type Expense } from '../../../../lib/expenses';
import { listSettlements, recordSettlement, type Settlement } from '../../../../lib/settlements';
import { computeNetBalances, simplifyDebts, type SettlementSuggestion } from '../../../../lib/balances';
import { getErrorMessage } from '../../../../lib/errors';

function memberName(member: GroupMember | undefined, fallbackId: string) {
  return member?.profile?.display_name || member?.profile?.email || fallbackId;
}

export default function GroupDetail() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { session } = useAuth();
  const currentUserId = session?.user.id;

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[] | null>(null);
  const [expenses, setExpenses] = useState<Expense[] | null>(null);
  const [settlements, setSettlements] = useState<Settlement[] | null>(null);
  const [suggestions, setSuggestions] = useState<SettlementSuggestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settlingKey, setSettlingKey] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    Promise.all([
      getGroup(groupId),
      listGroupMembers(groupId),
      listExpenses(groupId),
      listSettlements(groupId),
    ])
      .then(async ([groupData, memberData, expenseData, settlementData]) => {
        const splitsByExpense = await listExpenseSplits(expenseData.map((e) => e.id));
        const balances = computeNetBalances(
          memberData.map((m) => m.user_id),
          expenseData.map((e) => ({
            paid_by: e.paid_by,
            amount: e.amount,
            splits: splitsByExpense[e.id] ?? [],
          })),
          settlementData
        );

        setGroup(groupData);
        setMembers(memberData);
        setExpenses(expenseData);
        setSettlements(settlementData);
        setSuggestions(simplifyDebts(balances));
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

  async function handleMarkPaid(suggestion: SettlementSuggestion) {
    const key = `${suggestion.from}-${suggestion.to}`;
    setSettlingKey(key);
    try {
      await recordSettlement(groupId, suggestion.from, suggestion.to, suggestion.amount);
      load();
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to record settlement'));
    } finally {
      setSettlingKey(null);
    }
  }

  if (error) {
    return (
      <ScreenContainer>
        <Text style={styles.error}>{error}</Text>
      </ScreenContainer>
    );
  }

  if (!group || !members || !expenses || !settlements || !suggestions) {
    return (
      <ScreenContainer>
        <ActivityIndicator style={styles.loading} />
      </ScreenContainer>
    );
  }

  const membersById = new Map(members.map((m) => [m.user_id, m]));

  return (
    <ScreenContainer>
      <FlatList
        style={styles.list}
        data={expenses}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>{group.name}</Text>

            <Card>
              <Text style={styles.cardLabel}>Invite code</Text>
              <Text style={styles.inviteCode}>{group.invite_code}</Text>
            </Card>

            <Text style={styles.membersLine}>
              {members.map((m) => memberName(m, m.user_id)).join(', ')}
            </Text>

            <Button label="Share invite" variant="secondary" onPress={handleShare} />
            <Button
              label="Add expense"
              onPress={() => router.push(`/groups/${groupId}/expenses/new`)}
            />

            <Text style={styles.sectionLabel}>Balances</Text>
            {suggestions.length === 0 ? (
              <Text style={styles.placeholder}>Everyone is settled up.</Text>
            ) : (
              suggestions.map((s) => {
                const key = `${s.from}-${s.to}`;
                const fromLabel = s.from === currentUserId ? 'You' : memberName(membersById.get(s.from), s.from);
                const toLabel = s.to === currentUserId ? 'you' : memberName(membersById.get(s.to), s.to);
                return (
                  <Card key={key} style={styles.balanceCard}>
                    <Text style={styles.balanceText}>
                      {fromLabel} owe{s.from === currentUserId ? '' : 's'} {toLabel} ₹{s.amount.toFixed(2)}
                    </Text>
                    {s.from === currentUserId && (
                      <Button
                        label="Mark as paid"
                        variant="secondary"
                        loading={settlingKey === key}
                        onPress={() => handleMarkPaid(s)}
                      />
                    )}
                  </Card>
                );
              })
            )}

            <Text style={styles.sectionLabel}>Expenses</Text>
            {expenses.length === 0 && <Text style={styles.placeholder}>No expenses yet.</Text>}
          </View>
        }
        renderItem={({ item }) => {
          const payer = membersById.get(item.paid_by);
          const isYou = item.paid_by === currentUserId;
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.title, color: colors.text, marginTop: spacing.xxl },
  cardLabel: { ...typography.caption, color: colors.textMuted },
  membersLine: { ...typography.caption, color: colors.textMuted },
  inviteCode: { ...typography.heading, color: colors.text, letterSpacing: 2 },
  sectionLabel: { ...typography.heading, color: colors.text },
  list: { flex: 1 },
  balanceCard: { marginBottom: spacing.sm, gap: spacing.sm },
  balanceText: { ...typography.body, color: colors.text },
  expenseCard: { marginBottom: spacing.sm },
  expenseDescription: { ...typography.body, color: colors.text, fontWeight: '600' },
  expenseMeta: { ...typography.caption, color: colors.textMuted },
  placeholder: { ...typography.body, color: colors.textMuted },
  error: { ...typography.body, color: colors.danger, marginTop: spacing.xxl },
  loading: { flex: 1 },
});
