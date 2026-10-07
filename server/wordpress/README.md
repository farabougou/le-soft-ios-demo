# Mode application iOS (Reader App)

`lesoft-reader-app.php` retire les offres d'abonnement des pages servies à l'application iOS.

## Installation

1. Copier `lesoft-reader-app.php` dans `wp-content/mu-plugins/` sur le serveur de lesoftpost.com.
2. **Cache (obligatoire)** : exclure les User-Agent contenant `LeSoftApp-iOS` du cache de pages.
   - WP Rocket : Réglages avancés → « Ne jamais envoyer de pages en cache à ces User-Agents ».
   - LiteSpeed Cache : Exclusions → « Ne pas mettre en cache les User-Agents ».
   - Cloudflare : règle de cache « Bypass » quand le User-Agent contient `LeSoftApp-iOS`.
   Sans ça, l'app peut recevoir une page en cache qui contient encore les tarifs.
3. Vérifier `lesoft_is_premium_post()` : la règle doit correspondre à vos articles réservés.
4. Pour masquer un bloc précis (tarifs en FCFA, encart Orange Money…) : dans l'éditeur,
   bloc → Avancé → Classe CSS additionnelle → `lesoft-no-app`.

## Tester sans iPhone

```bash
curl -s -A "Mozilla/5.0 (iPhone) Mobile LeSoftApp-iOS/1.0" https://lesoftpost.com/ | grep -i -E "FCFA|abonn|membership-join|orange money|wave"
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -A "LeSoftApp-iOS" https://lesoftpost.com/membership-join/
```

La première commande ne doit rien afficher. La seconde doit afficher `302 …/membership-login/`.
