import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '../../../../components/ScreenContainer';
import { Card } from '../../../../components/Card';
import { Button } from '../../../../components/Button';
import { colors, radius, spacing, typography } from '../../../../theme/tokens';
import { useAuth } from '../../../../context/AuthProvider';
import { getGroup, listGroupMembers, type Group, type GroupMember } from '../../../../lib/groups';
import { listExpenses, listExpenseSplits, type Expense } from '../../../../lib/expenses';
import {
  listSettlements,
  createPendingSettlement,
  confirmSettlement,
  type Settlement,
} from '../../../../lib/settlements';
import { computeNetBalances, simplifyDebts, type SettlementSuggestion } from '../../../../lib/balances';
import { buildUpiPaymentLink } from '../../../../lib/upi';
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
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [awaitingConfirmKey, setAwaitingConfirmKey] = useState<string | null>(null);

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

  async function handlePayNow(suggestion: SettlementSuggestion) {
    const key = `${suggestion.from}-${suggestion.to}`;
    setError(null);

    const creditor = members?.find((m) => m.user_id === suggestion.to);
    const creditorVpa = creditor?.profile?.upi_vpa;
    if (!creditorVpa) {
      setError(
        `${memberName(creditor, suggestion.to)} hasn't set up a UPI ID yet, so a payment link can't be created.`
      );
      return;
    }

    try {
      const link = buildUpiPaymentLink({
        payeeVpa: creditorVpa,
        payeeName: memberName(creditor, suggestion.to),
        amount: suggestion.amount,
        note: group?.name ?? 'Settlr',
      });
      await Linking.openURL(link);
      setAwaitingConfirmKey(key);
    } catch (e) {
      setError(getErrorMessage(e, 'No UPI app found to open the payment link'));
    }
  }

  async function handleIvePaid(suggestion: SettlementSuggestion) {
    const key = `${suggestion.from}-${suggestion.to}`;
    setActionKey(key);
    try {
      await createPendingSettlement(groupId, suggestion.from, suggestion.to, suggestion.amount);
      setAwaitingConfirmKey(null);
      load();
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to record payment'));
    } finally {
      setActionKey(null);
    }
  }

  async function handleConfirmReceived(settlement: Settlement) {
    setActionKey(settlement.id);
    try {
      await confirmSettlement(settlement.id);
      load();
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to confirm settlement'));
    } finally {
      setActionKey(null);
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
  const pendingSettlements = settlements.filter((s) => s.status === 'pending');
  const awaitingMyConfirmation = pendingSettlements.filter((s) => s.to_user === currentUserId);

  return (
    <View style={styles.screen}>
      <ScreenContainer>
        <FlatList
          style={styles.list}
          data={expenses}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <View style={styles.header}>
              <Pressable onPress={() => router.push(`/groups/${groupId}/info`)}>
                <Text style={styles.title}>{group.name}</Text>
                <Text style={styles.titleHint}>Tap for invite code and members</Text>
              </Pressable>

              {awaitingMyConfirmation.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>Pending confirmation</Text>
                  {awaitingMyConfirmation.map((s) => (
                    <Card key={s.id} style={styles.balanceCard}>
                      <Text style={styles.balanceText}>
                        {memberName(membersById.get(s.from_user), s.from_user)} says they paid you ₹
                        {s.amount.toFixed(2)}
                      </Text>
                      <Button
                        label="Confirm received"
                        loading={actionKey === s.id}
                        onPress={() => handleConfirmReceived(s)}
                      />
                    </Card>
                  ))}
                </>
              )}

              <Text style={styles.sectionLabel}>Balances</Text>
              {suggestions.length === 0 ? (
                <Text style={styles.placeholder}>Everyone is settled up.</Text>
              ) : (
                suggestions.map((s) => {
                  const key = `${s.from}-${s.to}`;
                  const fromLabel =
                    s.from === currentUserId ? 'You' : memberName(membersById.get(s.from), s.from);
                  const toLabel =
                    s.to === currentUserId ? 'you' : memberName(membersById.get(s.to), s.to);
                  const hasPendingSettlement = pendingSettlements.some(
                    (p) => p.from_user === s.from && p.to_user === s.to
                  );

                  return (
                    <Card key={key} style={styles.balanceCard}>
                      <Text style={styles.balanceText}>
                        {fromLabel} owe{s.from === currentUserId ? '' : 's'} {toLabel} ₹
                        {s.amount.toFixed(2)}
                      </Text>

                      {s.from === currentUserId && hasPendingSettlement && (
                        <Text style={styles.pendingHint}>Waiting for {toLabel} to confirm</Text>
                      )}

                      {s.from === currentUserId && !hasPendingSettlement && awaitingConfirmKey !== key && (
                        <Button label="Pay now" onPress={() => handlePayNow(s)} />
                      )}

                      {s.from === currentUserId && !hasPendingSettlement && awaitingConfirmKey === key && (
                        <Button
                          label="I've paid"
                          variant="secondary"
                          loading={actionKey === key}
                          onPress={() => handleIvePaid(s)}
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

      <Pressable
        style={styles.fab}
        onPress={() => router.push(`/groups/${groupId}/expenses/new`)}>
        <Text style={styles.fabLabel}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { gap: spacing.md, paddingBottom: spacing.sm },
  title: { ...typography.title, color: colors.text, marginTop: spacing.xxl },
  titleHint: { ...typography.caption, color: colors.textMuted },
  sectionLabel: { ...typography.heading, color: colors.text },
  list: { flex: 1 },
  balanceCard: { marginBottom: spacing.sm, gap: spacing.sm },
  balanceText: { ...typography.body, color: colors.text },
  pendingHint: { ...typography.caption, color: colors.textMuted },
  expenseCard: { marginBottom: spacing.sm },
  expenseDescription: { ...typography.body, color: colors.text, fontWeight: '600' },
  expenseMeta: { ...typography.caption, color: colors.textMuted },
  placeholder: { ...typography.body, color: colors.textMuted },
  error: { ...typography.body, color: colors.danger, marginTop: spacing.xxl },
  loading: { flex: 1 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  fabLabel: { fontSize: 28, lineHeight: 30, color: colors.primaryText, fontWeight: '600' },
});
