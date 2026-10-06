import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppShell from '../../App';
export default function Layout() { return <SafeAreaProvider><AppShell><Slot/></AppShell></SafeAreaProvider>; }
