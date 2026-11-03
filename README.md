# TinyTorque

**Build. Tune. Race. Repeat.**

Un jeu original de voitures radiocommandées conçu autour d'une idée : **vous réglez les véhicules, les pilotes automatiques les mettent à l'épreuve**.

## Prototype v0.1

- Circuit et voitures en **3D** avec Three.js
- **4 voitures** dont les paramètres sont modifiables séparément
- Puissance, vitesse maximale, adhérence, direction et masse
- Pilotes IA qui suivent la piste et adaptent leur vitesse aux virages
- Courses automatiques de **3 tours**, classement, chronos et télémétrie
- Caméras **TV**, **suivi** et **dessus**
- Accélération de la simulation : **1×, 3× ou 8×**
- Sauvegarde locale des réglages et **import/export JSON**

Les modifications changent le comportement des voitures. Le moteur est une simulation **arcade simplifiée**, pas une reproduction de la physique de Re-Volt.

## Jouer

Le site est statique : aucun serveur applicatif, compte ou base de données.

**GitHub Pages** : ouvrez **Settings > Pages**, puis choisissez **GitHub Actions** dans *Build and deployment > Source*. Le workflow `.github/workflows/deploy.yml` vérifie la syntaxe JavaScript et publie le site. GitHub affichera son adresse de publication une fois le déploiement terminé.

**En local** :

```bash
python -m http.server 8000
```

Puis ouvrez http://localhost:8000. Une connexion Internet est nécessaire pour télécharger Three.js depuis le CDN.

**Raccourcis** : espace (lancer/pause), R (réinitialiser), touches 1 à 4 (sélectionner une voiture).

## Suite possible

- Choix de circuits, obstacles et collisions plus abouties
- Vrais essais en ligne droite / freinage / virages avec mesures comparables
- Championnats avec historique des records
- Optimisation automatique des réglages, génération après génération

## À propos

TinyTorque est un projet original, inspiré par le plaisir de modifier les paramètres de voitures RC et de les laisser courir. Il ne contient **aucun code, circuit, modèle ou ressource du jeu Re-Volt**.

Aucune licence de réutilisation du code n'a encore été choisie.
