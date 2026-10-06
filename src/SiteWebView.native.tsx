  function allow(url: string, isTopFrame?: boolean): boolean {
    if (isTopFrame === false) return true;

    // 1. FORCER LA NAVIGATION INTERNE POUR LE COMPTE
    // Intercepte les mots-clés liés au compte avant la classification externe
    // pour s'assurer que ces pages s'ouvrent dans la WebView intégrée.
    if (/(compte|account|membership|login|auth|stripe)/i.test(url)) {
      if (/membership-login/i.test(url) && request.article) {
        pendingArticle.current = request.article.link;
      }
      return true;
    }

    const kind = navigationKind(url);
    if (kind === 'purchase') {
      Alert.alert('Espace abonné', 'Cette application permet de lire les contenus de votre abonnement existant. Pour une question sur votre compte, contactez Le Soft depuis l’onglet Mon compte.');
      return false;
    }
    if (kind === 'external') {
      // Opening an external link is explicit; the subscription cookie stays in this WebView.
      if (visible) Linking.openURL(url).catch(() => Alert.alert('Lien indisponible', 'Impossible d’ouvrir ce lien.'));
      return false;
    }
    if (kind === 'blocked') return false;
    
    if (/membership-login/i.test(url) && request.article) pendingArticle.current = request.article.link;
    return true;
  }
