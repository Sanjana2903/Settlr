import { Text, StyleSheet } from 'react-native';
import { ScreenContainer } from '../../components/ScreenContainer';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { colors, spacing, typography } from '../../theme/tokens';
import { useAuth } from '../../context/AuthProvider';

export default function Home() {
  const { session, signOut } = useAuth();

  return (
    <ScreenContainer>
      <Text style={styles.title}>Settlr</Text>

      <Card>
        <Text style={styles.cardLabel}>Signed in as</Text>
        <Text style={styles.cardValue}>{session?.user.email}</Text>
      </Card>

      <Text style={styles.placeholder}>
        Groups, expenses, and balances land here in Phase 1.
      </Text>

      <Button label="Sign out" variant="secondary" onPress={signOut} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text, marginTop: spacing.xxl },
  cardLabel: { ...typography.caption, color: colors.textMuted },
  cardValue: { ...typography.heading, color: colors.text },
  placeholder: { ...typography.body, color: colors.textMuted, flex: 1 },
});
