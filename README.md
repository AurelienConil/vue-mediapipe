# Vue MediaPipe

Une application Vue.js 3 avec TypeScript qui utilise MediaPipe pour la détection et l'analyse des gestes de la main en temps réel.

## Fonctionnalités

- **Détection de mains en temps réel** : Utilise MediaPipe Hands pour détecter et tracker les mains
- **Extraction de features** : Multiple extracteurs pour analyser les mouvements et positions des mains
- **Préprocesseurs** : Filtres de Kalman, normalisation, centrage pour améliorer la qualité des données
- **Analyseurs** : Détection de tap-tip et autres gestes
- **Visualisation** : Graphiques et moniteurs temps réel pour les données et événements
- **Architecture modulaire** : Système d'événements, stores Pinia, composants Vue réutilisables

## Prérequis

- Node.js (version 18 ou supérieure recommandée)
- npm ou yarn
- Une webcam pour la détection de mains

## Installation

1. **Cloner le repository**
   ```bash
   git clone <repository-url>
   cd vue-mediapipe
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Lancer l'application en mode développement**
   ```bash
   npm run dev
   ```

4. **Ouvrir votre navigateur** et aller à l'adresse indiquée ( `http://localhost:5173`)

## Scripts disponibles

- `npm run dev` : Lance le serveur de développement Vite
- `npm run build` : ( pas disponible encore ) Compile l'application pour la production
- `npm run preview` : ( pas disponible encore ) Prévisualise la version compilée

## Architecture

### Structure du projet

- `src/components/` : Composants Vue pour l'interface utilisateur
- `src/mediapipe/` : Logique MediaPipe et traitement des données
  - `analyzers/` : Analyseurs de gestes et comportements
  - `core/` : Processeur MediaPipe principal et système d'événements
  - `extractors/` : Extracteurs de features des données de mains
  - `preprocessors/` : Filtres et préprocesseurs de données
- `src/stores/` : Stores Pinia pour la gestion d'état
- `src/views/` : Vues principales de l'application

### Technologies utilisées

- **Vue.js 3** avec Composition API et `<script setup>`
- **TypeScript** pour le typage statique
- **Vite** pour le bundling et le développement
- **MediaPipe** pour la détection de mains
- **Pinia** pour la gestion d'état
- **Vuetify** pour les composants UI
- **Chart.js** pour les visualisations
- **P5.js** pour les rendus graphiques avancés

## Développement

L'application utilise une architecture basée sur des événements avec un système de stores centralisé. Les données de MediaPipe sont traitées par des extracteurs de features, puis analysées par des analyseurs spécialisés qui émettent des événements via un EventBus.

Pour plus de détails sur l'architecture du CoreStore, consultez la [documentation](docs/CoreStore.md).
