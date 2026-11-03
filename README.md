# TinyTorque

**Build. Tune. Race. Repeat.**

Un prototype original de laboratoire de voitures radiocommandées : on modifie les voitures, on laisse l'IA piloter, puis on compare les performances.

## Démarrage

Ce projet fonctionne comme un site statique. Une fois GitHub Pages activé, ouvrez l'URL fournie par GitHub.

Pour tester localement :

\`\`\`bash
python -m http.server 8000
\`\`\`

Puis ouvrez http://localhost:8000. Une connexion Internet est nécessaire pour charger Three.js depuis le CDN.

## Version 0.1

- Circuit 3D procédural, caméra TV / poursuite / aérienne
- Quatre voitures radiocommandées avec réglages individuels
- Pilotes automatiques et physique de conduite simplifiée
- Courses de trois tours, classement et télémétrie
- Profils enregistrés dans le navigateur, import/export JSON
- Contrôles de simulation 1× / 3× / 8×

Le jeu ne contient **aucun code ni aucune ressource de Re-Volt**. C'est un hommage original au plaisir de régler des voitures et de les observer courir.

## Limites connues

Le comportement physique est une simulation arcade, pas un modèle automobile scientifique. Les trajectoires sont pilotées par points de passage et ne constituent pas une IA d'apprentissage. La version initiale ne propose ni obstacles dynamiques ni réseau multijoueur.

## Publication

Le dépôt contient un workflow GitHub Pages. Dans **Settings > Pages**, choisissez **GitHub Actions** comme source de publication si nécessaire.

Licence : MIT.
