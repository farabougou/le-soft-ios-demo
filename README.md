# Le Soft iOS

Application Expo SDK 57 pour les lecteurs de lesoftpost.com.

## Livraison

Chaque envoi sur `main` déclenche le workflow EAS `.eas/workflows/testflight.yml` : vérification TypeScript, lint, tests de régression, construction iOS et soumission à TestFlight. Une défaillance bloque les étapes suivantes. La publication publique App Store reste distincte.

## Développement

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm start
```

## Correctif 4

- Session commune au compte et au lecteur ; accès Premium décidé par le site.
- Photos RSS, médias et métadonnées avec sources de secours.
- Logo officiel, cartes avec photo, couleurs bordeaux, favoris et recherche.
- Validation finale nécessaire sur appareil iOS avec un abonnement réel.

Les clés Apple et identifiants de signature restent dans EAS ; aucune clé n'est incluse dans le dépôt.
