# Ouvrir les liens lesoftpost.com dans l'app iPhone

1. Remplacer `TEAMID` par le Team ID Apple (developer.apple.com → Account → Membership details, 10 caractères).
2. Déposer le fichier `apple-app-site-association` (sans extension) sur le serveur :
   `https://lesoftpost.com/.well-known/apple-app-site-association`
   et aussi pour `www.lesoftpost.com`.
3. Le serveur doit le servir en HTTPS, sans redirection, avec `Content-Type: application/json`,
   et le pare-feu anti-robots (Anubis) ne doit pas le bloquer : Apple le télécharge via son CDN.
4. Vérifier : `curl -sI https://lesoftpost.com/.well-known/apple-app-site-association` doit répondre `200`.

Les pages de connexion et d'abonnement restent dans Safari ; tout autre lien ouvre l'article dans l'app.
L'app doit être réinstallée (ou mise à jour) après la mise en ligne du fichier pour qu'iOS le prenne en compte.
