import React, { useRef } from 'react';
import { StyleSheet, SafeAreaView, Linking, Platform, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';

const VOXA_URL = 'https://askvoxa.com';

export default function App() {
  const webviewRef = useRef<WebView>(null);

  const handleShouldStartLoadWithRequest = (request: any) => {
    const { url } = request;
    
    // Intercept MercadoPago links to open in external browser
    if (url.includes('mercadopago.com') || url.includes('mercadolivre.com')) {
       Linking.openURL(url).catch(err => {
         console.error("Failed to open URL:", err);
         Alert.alert("Erro", "Não foi possível abrir o link externo.");
       });
       return false;
    }
    return true;
  };

  const customUserAgent = Platform.OS === 'android' 
    ? 'Mozilla/5.0 (Linux; Android 13; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36'
    : 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="dark" />
      <WebView
        ref={webviewRef}
        source={{ uri: VOXA_URL }}
        style={styles.webview}
        userAgent={customUserAgent}
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
