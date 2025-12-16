# CoreStore - Documentation

## 🎯 Vue d'ensemble

Le `CoreStore` est le store Pinia central qui gère toutes les informations de base de MediaPipe, permettant un accès facile et réactif aux données de détection des mains.

## 📋 Fonctionnalités principales

### ✅ Détection des mains
- État de détection (active/inactive)
- Nombre de mains détectées (0, 1, 2)
- Identification main gauche/droite
- Niveau de confiance pour chaque main

### 📊 Monitoring des performances
- FPS en temps réel et moyenne
- Compteur de frames traitées
- Temps de traitement moyen
- Historique des performances

### 🔍 Tests conditionnels
- `hasHands`: Au moins une main détectée
- `hasLeftHand`: Main gauche détectée
- `hasRightHand`: Main droite détectée
- `bothHands`: Les deux mains détectées
- `singleHand`: Une seule main détectée

## 🚀 Utilisation

### Import et initialisation
```typescript
import { useCoreStore } from '@/stores/CoreStore'

// Dans vos composants Vue
const coreStore = useCoreStore()
```

### Vérifications de base
```typescript
// Vérifier si des mains sont détectées
if (coreStore.hasHands) {
  console.log(`${coreStore.handCount} main(s) détectée(s)`)
}

// Vérifications spécifiques
if (coreStore.hasLeftHand) {
  console.log('Main gauche présente')
}

if (coreStore.bothHands) {
  console.log('Les deux mains sont présentes!')
}
```

### Accès aux informations détaillées
```typescript
// Informations d'une main spécifique
const leftHandInfo = coreStore.getHandInfo('Left')
if (leftHandInfo) {
  console.log(`Confiance: ${leftHandInfo.confidence}`)
  console.log(`Landmarks: ${leftHandInfo.landmarkCount}`)
}

// Tests de confiance
if (coreStore.isHandConfident('Left', 0.8)) {
  console.log('Main gauche détectée avec 80%+ de confiance')
}

// Confiance des deux mains
const bothHandsConfidence = coreStore.getBothHandsConfidence()
if (bothHandsConfidence) {
  console.log(`Gauche: ${bothHandsConfidence.left}, Droite: ${bothHandsConfidence.right}`)
}
```

### Monitoring des performances
```typescript
// FPS et performance
console.log(`FPS actuel: ${coreStore.status.fps}`)
console.log(`FPS moyen: ${coreStore.averageFps}`)
console.log(`Temps de traitement: ${coreStore.status.averageProcessingTime}ms`)
console.log(`Frames traitées: ${coreStore.status.frameCount}`)
```

### Gestion d'état
```typescript
// Démarrer/arrêter la détection (géré par MediaPipeStore)
coreStore.startDetection()
coreStore.stopDetection()

// Reset complet
coreStore.reset()

// Gestion d'erreurs
if (coreStore.error) {
  console.error('Erreur CoreStore:', coreStore.error)
  coreStore.clearError()
}
```

## 📊 Structure des données

### CoreStatus
```typescript
interface CoreStatus {
  isDetecting: boolean           // État de détection
  fps: number                    // FPS actuel
  frameCount: number            // Nombre total de frames
  lastFrameTime: number         // Timestamp de la dernière frame
  averageProcessingTime: number // Temps de traitement moyen (ms)
}
```

### HandInfo
```typescript
interface HandInfo {
  isDetected: boolean    // Main détectée
  confidence: number     // Niveau de confiance (0-1)
  side: 'Left' | 'Right' // Côté de la main
  landmarkCount: number  // Nombre de landmarks détectés
}
```

## 🔗 Intégration avec MediaPipe

Le CoreStore est automatiquement mis à jour par le `MediaPipeProcessor` à chaque frame traitée :

1. **Conversion des résultats** → `MediaPipeFrame`
2. **Mise à jour CoreStore** → `coreStore.updateFrame(handsData)`
3. **Preprocessing** → Optionnel
4. **Feature Extraction** → Extractors personnalisés
5. **Analysis** → Analyzers personnalisés

## 🎨 Composants d'exemple

### CoreStatusMonitor.vue
Affiche le statut complet du CoreStore avec un design moderne.

### CoreStoreExample.vue
Démonstrateur interactif avec simulation de détections.

## 🔄 Cycle de vie

1. **Initialisation** → Store créé avec Pinia
2. **Démarrage** → `startDetection()` 
3. **Traitement** → `updateFrame()` à chaque frame MediaPipe
4. **Monitoring** → Calculs automatiques FPS, performances
5. **Arrêt** → `stopDetection()` ou `reset()`

## 🛠️ Cas d'usage courants

### Interfaces utilisateur adaptatives
```typescript
// Affichage conditionnel basé sur la détection
<div v-if="coreStore.hasHands">
  <div v-if="coreStore.singleHand">Interface pour une main</div>
  <div v-else-if="coreStore.bothHands">Interface pour deux mains</div>
</div>
```

### Déclenchement d'actions
```typescript
// Watcher sur la détection des mains
watch(() => coreStore.bothHands, (newVal) => {
  if (newVal) {
    console.log('Déclenchement action deux mains')
    // Logique spécifique...
  }
})
```

### Validation de gestes
```typescript
// Pré-conditions pour l'analyse de gestes
if (coreStore.isHandConfident('Left', 0.8) && coreStore.isHandConfident('Right', 0.8)) {
  // Démarrer analyse de geste complexe
  gestureAnalyzer.start()
}
```

## 🔧 Performance

- **Réactif** : Utilise Vue 3 `reactive` et `computed`
- **Optimisé** : Historique limité (30 entrées par défaut)
- **Léger** : Calculs uniquement sur changement
- **Thread-safe** : Gestion single-threaded avec Vue

## 🚨 Bonnes pratiques

1. **Utilisez les computed properties** plutôt que d'accéder directement aux données
2. **Testez la confiance** avant les analyses critiques
3. **Surveillez les performances** via les métriques FPS
4. **Gérez les erreurs** avec `coreStore.error`
5. **Resettez proprement** avec `coreStore.reset()`