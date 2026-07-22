import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { ScreenContainer } from '../../../../../components/ScreenContainer';
import { TextField } from '../../../../../components/TextField';
import { Button } from '../../../../../components/Button';
import { colors, radius, spacing, typography } from '../../../../../theme/tokens';
import { useAuth } from '../../../../../context/AuthProvider';
import { listGroupMembers, type GroupMember } from '../../../../../lib/groups';
import { createExpense } from '../../../../../lib/expenses';
import { computeEqualSplit, computeExactSplit, computePercentageSplit } from '../../../../../lib/splits';
import { getErrorMessage } from '../../../../../lib/errors';

type SplitType = 'equal' | 'exact' | 'percentage';

function memberLabel(member: GroupMember, currentUserId?: string) {
  const name = member.profile?.display_name || member.profile?.email || member.user_id;
  return member.user_id === currentUserId ? `${name} (you)` : name;
}

export default function NewExpense() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { session } = useAuth();
  const currentUserId = session?.user.id;

  const [members, setMembers] = useState<GroupMember[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState<string | undefined>(currentUserId);
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [includedMembers, setIncludedMembers] = useState<Set<string>>(new Set());
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});
  const [percentages, setPercentages] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      listGroupMembers(groupId)
        .then((data) => {
          setMembers(data);
          setIncludedMembers(new Set(data.map((m) => m.user_id)));
          if (!paidBy) setPaidBy(currentUserId);
        })
        .catch((e) => setLoadError(getErrorMessage(e, 'Failed to load group members')));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId])
  );

  const parsedAmount = useMemo(() => {
    const value = Number(amount);
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [amount]);

  function toggleIncluded(userId: string) {
    setIncludedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function handleSave() {
    setError(null);

    if (description.trim().length === 0) {
      setError('Add a description');
      return;
    }
    if (!parsedAmount) {
      setError('Enter a valid amount');
      return;
    }
    if (!paidBy) {
      setError('Choose who paid');
      return;
    }

    try {
      let splits;
      if (splitType === 'equal') {
        splits = computeEqualSplit(parsedAmount, Array.from(includedMembers));
      } else if (splitType === 'exact') {
        splits = computeExactSplit(
          parsedAmount,
          (members ?? []).map((m) => ({
            user_id: m.user_id,
            amount: Number(exactAmounts[m.user_id] ?? 0),
          }))
        );
      } else {
        splits = computePercentageSplit(
          parsedAmount,
          (members ?? []).map((m) => ({
            user_id: m.user_id,
            percentage: Number(percentages[m.user_id] ?? 0),
          }))
        );
      }

      setSaving(true);
      await createExpense(groupId, description.trim(), parsedAmount, paidBy, splits);
      router.back();
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to save expense'));
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

  if (!members) {
    return (
      <ScreenContainer>
        <ActivityIndicator style={styles.loading} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>New expense</Text>

        <TextField label="Description" placeholder="Dinner, cab, groceries..." value={description} onChangeText={setDescription} />
        <TextField label="Amount" placeholder="0.00" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />

        <Text style={styles.sectionLabel}>Paid by</Text>
        <View style={styles.chipRow}>
          {members.map((m) => (
            <Pressable
              key={m.user_id}
              onPress={() => setPaidBy(m.user_id)}
              style={[styles.chip, paidBy === m.user_id && styles.chipSelected]}>
              <Text style={[styles.chipLabel, paidBy === m.user_id && styles.chipLabelSelected]}>
                {memberLabel(m, currentUserId)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Split</Text>
        <View style={styles.chipRow}>
          {(['equal', 'exact', 'percentage'] as SplitType[]).map((type) => (
            <Pressable
              key={type}
              onPress={() => setSplitType(type)}
              style={[styles.chip, splitType === type && styles.chipSelected]}>
              <Text style={[styles.chipLabel, splitType === type && styles.chipLabelSelected]}>
                {type[0].toUpperCase() + type.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {splitType === 'equal' &&
          members.map((m) => (
            <Pressable
              key={m.user_id}
              onPress={() => toggleIncluded(m.user_id)}
              style={styles.memberRow}>
              <Text style={styles.memberName}>{memberLabel(m, currentUserId)}</Text>
              <Text style={styles.memberToggle}>
                {includedMembers.has(m.user_id) ? 'Included' : 'Excluded'}
              </Text>
            </Pressable>
          ))}

        {splitType === 'exact' &&
          members.map((m) => (
            <TextField
              key={m.user_id}
              label={memberLabel(m, currentUserId)}
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={exactAmounts[m.user_id] ?? ''}
              onChangeText={(text) => setExactAmounts((prev) => ({ ...prev, [m.user_id]: text }))}
            />
          ))}

        {splitType === 'percentage' &&
          members.map((m) => (
            <TextField
              key={m.user_id}
              label={memberLabel(m, currentUserId)}
              placeholder="0"
              keyboardType="decimal-pad"
              value={percentages[m.user_id] ?? ''}
              onChangeText={(text) => setPercentages((prev) => ({ ...prev, [m.user_id]: text }))}
            />
          ))}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button label="Save expense" onPress={handleSave} loading={saving} />
        <Button label="Cancel" variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: { gap: spacing.md, paddingBottom: spacing.xl },
  title: { ...typography.title, color: colors.text, marginTop: spacing.xxl },
  sectionLabel: { ...typography.heading, color: colors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipLabel: { ...typography.body, color: colors.text },
  chipLabelSelected: { color: colors.primaryText },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  memberName: { ...typography.body, color: colors.text },
  memberToggle: { ...typography.caption, color: colors.primary },
  error: { ...typography.body, color: colors.danger },
  loading: { flex: 1 },
});
