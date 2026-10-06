import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { SiteProps } from './SiteWebView.native';

// Websites cannot embed the publisher's authenticated page across origins.
// Production iOS uses SiteWebView.native.tsx and a persistent in-app session.
export default function SiteWebView({ visible, request, theme, onClose }: SiteProps) {
  if (!visible) return null;
  return <View style={[st.layer, { backgroundColor: theme.bg }]}>
    <Text style={[st.title, { color: theme.text }]}>{request.article?.title || 'Espace abonné'}</Text>
    <Text style={[st.text, { color: theme.muted }]}>Dans l’application iPhone, votre compte et vos articles partagent la même session sécurisée. Cet aperçu Web ouvre la page sur le site officiel.</Text>
    <Pressable accessibilityRole="button" onPress={() => Linking.openURL(request.uri)} style={[st.button, { backgroundColor: theme.red }]}><Text style={st.buttonText}>Ouvrir la page</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={onClose} style={st.button}><Text style={{ color: theme.text }}>Fermer</Text></Pressable>
  </View>;
}
const st = StyleSheet.create({
  layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 100, padding: 30, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center', maxWidth: 550 },
  text: { fontSize: 16, lineHeight: 25, marginVertical: 25, maxWidth: 500, textAlign: 'center' },
  button: { minHeight: 48, padding: 14, borderRadius: 12, alignItems: 'center', minWidth: 190 },
  buttonText: { color: '#FFF', fontWeight: '700' },
});
