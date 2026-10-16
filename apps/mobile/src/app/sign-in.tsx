import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ClipboardCheck, HandCoins, PenLine, type LucideIcon } from 'lucide-react-native';
import type { SessionDTO } from '@amplify/domain';
import { api, ApiError, errorMessage } from '@/lib/api';
import { completeSignIn } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { Button, colors, Divider, Notice, radius, Row, ScreenHeader, Segmented, space, Text, TextField, toast } from '@/ui';

const DEMOS: { as: 'creator' | 'backer' | 'reviewer'; name: string; role: string; icon: LucideIcon; body: string }[] = [
  { as: 'creator', name: 'Maya Okafor', role: 'Creator', icon: PenLine, body: 'Has a campaign running ads, one needing changes and a draft.' },
  { as: 'backer', name: 'Sam Rivera', role: 'Backer', icon: HandCoins, body: 'Backs several campaigns, including a completed one and a refund.' },
  { as: 'reviewer', name: 'Priya Natarajan', role: 'Reviewer', icon: ClipboardCheck, body: 'Reviews submissions, launches ads and runs the demo controls.' },
];

export default function SignIn() {
  const router = useRouter();
  const { reason, mode: initialMode } = useLocalSearchParams<{ reason?: string; mode?: string }>();
  const current = useSession((s) => s.user);
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode === 'signup' ? 'signup' : 'signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const finish = async (s: SessionDTO) => {
    await completeSignIn(s);
    toast.success(`Signed in as ${s.user.name}`);
    router.back();
  };

  const submit = async () => {
    setBusy('form');
    setFields({});
    try {
      const s = await api<SessionDTO>(mode === 'signin' ? '/auth/login' : '/auth/signup', { method: 'POST', body: mode === 'signin' ? { email, password } : { name, email, password } });
      await finish(s);
    } catch (e) {
      if (e instanceof ApiError && e.fields) setFields(e.fields);
      else toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const demo = async (as: (typeof DEMOS)[number]['as']) => {
    setBusy(as);
    try {
      await finish(await api<SessionDTO>('/auth/demo', { method: 'POST', body: { as } }));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader close title={current ? 'Switch account' : 'Sign in'} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: space.xxxl }} keyboardShouldPersistTaps="handled">
        {reason === 'submit' ? (
          <Notice tone="accent" title="One last step">Sign in or create a free account to submit your campaign. Your draft is saved and will move to your account.</Notice>
        ) : null}

        <View style={{ gap: space.md }}>
          <View>
            <Text variant="heading">Explore with a demo account</Text>
            <Text variant="label">One tap. Each shows a different side of the product.</Text>
          </View>
          {DEMOS.map((d) => (
            <Pressable key={d.as} onPress={() => demo(d.as)} disabled={!!busy} style={({ pressed }) => [styles.demo, pressed && { opacity: 0.9 }, current?.name === d.name && styles.demoCurrent]} accessibilityRole="button" accessibilityLabel={`Continue as ${d.name}, ${d.role}`}>
              <View style={styles.demoIcon}>
                <d.icon size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Row gap={6}>
                  <Text variant="bodyStrong">{d.name}</Text>
                  <Text variant="caption">· {d.role}</Text>
                </Row>
                <Text variant="caption">{d.body}</Text>
              </View>
              <Text variant="label" weight="semi" color={colors.accent}>{busy === d.as ? '…' : current?.name === d.name ? 'Current' : 'Use'}</Text>
            </Pressable>
          ))}
        </View>

        <Row gap={space.md}>
          <Divider style={{ flex: 1 }} />
          <Text variant="caption">or use your own account</Text>
          <Divider style={{ flex: 1 }} />
        </Row>

        <View style={{ gap: space.md }}>
          <Segmented value={mode} onChange={setMode} options={[{ key: 'signin', label: 'Sign in' }, { key: 'signup', label: 'Create account' }]} />
          {mode === 'signup' ? <TextField label="Name" value={name} onChangeText={setName} autoCapitalize="words" error={fields.name} textContentType="name" /> : null}
          <TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={fields.email} />
          <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry error={fields.password} hint={mode === 'signup' ? 'At least 8 characters' : undefined} />
          <Button label={mode === 'signin' ? 'Sign in' : 'Create account'} onPress={submit} loading={busy === 'form'} full size="lg" />
          <Text variant="caption" align="center">Anything you backed or drafted as a guest on this device moves to your account.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  demo: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, borderWidth: 1, borderColor: colors.border },
  demoCurrent: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  demoIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
});
