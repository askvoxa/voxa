import React, { useRef } from 'react';
import { StyleSheet, SafeAreaView, Linking, Platform, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';

const VOXA_URL = 'https://achados-ai.onrender.com';

export default function App() {
  const webviewRef = useRef<WebView>(null);

  const handleShouldStartLoadWithRequest = (request: any) => {
    const { url } = request;
    
    // Intercept MercadoPago or Google OAuth auth links
    if (url.includes('mercadopago.com') || url.includes('accounts.google.com') || url.includes('mercadolivre.com')) {
       Linking.openURL(url).catch(err => {
         console.error("Failed to open URL:", err);
         Alert.alert("Erro", "Não foi possível abrir o link externo.");
       });
       return false;
    }
    return true;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <WebView
        ref={webviewRef}
        source={{ uri: VOXA_URL }}
        style={styles.webview}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        onPermissionRequest={(request) => {
          if (Platform.OS === 'android') {
            request.grant();
          }
        }}
        // Needed for deep links
        originWhitelist={['*']}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    marginTop: Platform.OS === 'android' ? Constants.statusBarHeight : 0,
  },
  webview: {
    flex: 1,
  },
});
