# TinyTorque

**Build. Tune. Race. Repeat.**

Un jeu original de voitures radiocommandées conçu autour d'une idée : **vous réglez les véhicules, les pilotes automatiques les mettent à l'épreuve**.

## Prototype v0.2

- Circuit et voitures en **3D** avec Three.js
- **4 voitures** dont les paramètres sont modifiables séparément
- **13 réglages + transmission** (traction, propulsion, 4 roues motrices)
- Rapports de boîte, différentiel, pression des pneus, répartition du freinage
- Masse, centre de gravité, suspension, aérodynamique, agressivité du pilote
- **Physique dynamique** : inertie, glissement des pneus, sous-virage / survirage et perte d'adhérence
- Voitures qui quittent la piste, pertes de motricité sur l'herbe, poussière et fumée de pneus
- Remises en piste avec pénalités et abandons au bout de 300 secondes
- Châssis distincts : empattement, répartition des masses, inertie et adhérence intrinsèque
- Pilotes IA qui suivent la piste et adaptent leur vitesse aux virages
- Courses automatiques de **3 tours**, classement, chronos et télémétrie
- Caméras **TV**, **suivi** et **dessus**
- Accélération de la simulation : **1×, 3× ou 8×**
- Sauvegarde locale des réglages et **import/export JSON**

Les modifications changent réellement le comportement des voitures. Contrairement à la v0.1, l'orientation de la carrosserie et la vitesse sont indépendantes : une voiture peut glisser latéralement. La transmission avant/arriére/4×4 répartit la force sur les essieux, qui disposent chacun d'un budget d'adhérence partagé entre accélérer/freiner et tourner.

Le moteur reste une **approximation arcade du modèle dynamique à deux essieux**, pas une simulation à quatre pneus avec collisions solides, ressorts 3D, usure, boîte multirapport ni reproduction exacte de Re-Volt. Les tours sont validés par passages aux checkpoints, et les essais restent déterministes sauf pour les effets cosmétiques. Les résultats peuvent varier si l'on modifie les réglages pendant une course.

**Validation :** les tests Node vérifient les différences de transmission, la perte de motricité hors piste, l'effet de la transmission et la stabilité numérique. Ils s'exécutent avant chaque publication GitHub Pages.

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
