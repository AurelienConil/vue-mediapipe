&lt;template&gt;
  &lt;div class="core-store-example"&gt;
    &lt;h2&gt;🎯 Exemple d'utilisation du CoreStore&lt;/h2&gt;
    
    &lt;div class="example-section"&gt;
      &lt;h3&gt;📝 Code d'exemple&lt;/h3&gt;
      &lt;pre&gt;&lt;code&gt;{{ exampleCode }}&lt;/code&gt;&lt;/pre&gt;
    &lt;/div&gt;

    &lt;div class="demo-section"&gt;
      &lt;h3&gt;🚀 Démo en temps réel&lt;/h3&gt;
      
      &lt;div class="demo-controls"&gt;
        &lt;button @click="simulateLeftHand" :disabled="!coreStore.status.isDetecting"&gt;
          👈 Simuler Main Gauche
        &lt;/button&gt;
        &lt;button @click="simulateRightHand" :disabled="!coreStore.status.isDetecting"&gt;
          👉 Simuler Main Droite
        &lt;/button&gt;
        &lt;button @click="simulateBothHands" :disabled="!coreStore.status.isDetecting"&gt;
          👏 Simuler Deux Mains
        &lt;/button&gt;
        &lt;button @click="simulateNoHands" :disabled="!coreStore.status.isDetecting"&gt;
          🚫 Aucune Main
        &lt;/button&gt;
      &lt;/div&gt;

      &lt;div class="demo-info"&gt;
        &lt;div class="info-item"&gt;
          &lt;strong&gt;État de base:&lt;/strong&gt;
          &lt;ul&gt;
            &lt;li&gt;Détection active: {{ coreStore.status.isDetecting ? '✅' : '❌' }}&lt;/li&gt;
            &lt;li&gt;Nombre de mains: {{ coreStore.handCount }}&lt;/li&gt;
            &lt;li&gt;FPS: {{ coreStore.status.fps }}&lt;/li&gt;
            &lt;li&gt;Frames traitées: {{ coreStore.status.frameCount }}&lt;/li&gt;
          &lt;/ul&gt;
        &lt;/div&gt;

        &lt;div class="info-item"&gt;
          &lt;strong&gt;Tests conditionnels:&lt;/strong&gt;
          &lt;ul&gt;
            &lt;li v-if="coreStore.hasHands"&gt;{{ getHandDescription() }}&lt;/li&gt;
            &lt;li v-else&gt;Aucune main détectée&lt;/li&gt;
            &lt;li&gt;Une seule main: {{ coreStore.singleHand ? '✅' : '❌' }}&lt;/li&gt;
            &lt;li&gt;Deux mains: {{ coreStore.bothHands ? '✅' : '❌' }}&lt;/li&gt;
          &lt;/ul&gt;
        &lt;/div&gt;

        &lt;div class="info-item"&gt;
          &lt;strong&gt;Informations détaillées:&lt;/strong&gt;
          &lt;ul&gt;
            &lt;li v-if="coreStore.leftHandInfo"&gt;
              Main gauche: {{ Math.round(coreStore.leftHandInfo.confidence * 100) }}% confiance
            &lt;/li&gt;
            &lt;li v-if="coreStore.rightHandInfo"&gt;
              Main droite: {{ Math.round(coreStore.rightHandInfo.confidence * 100) }}% confiance
            &lt;/li&gt;
            &lt;li v-if="!coreStore.hasHands"&gt;Aucune information de main disponible&lt;/li&gt;
          &lt;/ul&gt;
        &lt;/div&gt;
      &lt;/div&gt;
    &lt;/div&gt;
  &lt;/div&gt;
&lt;/template&gt;

&lt;script setup lang="ts"&gt;
import { useCoreStore } from '@/stores/CoreStore'
import type { HandData } from '@/mediapipe/types'

const coreStore = useCoreStore()

const exampleCode = `// Dans vos composants Vue
import { useCoreStore } from '@/stores/CoreStore'

const coreStore = useCoreStore()

// Vérifications de base
if (coreStore.hasHands) {
  console.log(\`\${coreStore.handCount} main(s) détectée(s)\`)
}

// Tests conditionnels spécifiques
if (coreStore.hasLeftHand && coreStore.hasRightHand) {
  console.log('Les deux mains sont présentes!')
}

if (coreStore.isHandConfident('Left', 0.8)) {
  console.log('Main gauche détectée avec 80%+ confiance')
}

// Accès aux informations détaillées
const leftHand = coreStore.getHandInfo('Left')
if (leftHand) {
  console.log(\`Confiance: \${leftHand.confidence}\`)
}

// Monitoring des performances
console.log(\`FPS: \${coreStore.status.fps}\`)
console.log(\`Temps traitement: \${coreStore.status.averageProcessingTime}ms\`)
`

const simulateLeftHand = () =&gt; {
  const leftHandData: HandData = {
    landmarks: Array.from({ length: 21 }, () =&gt; ({ x: Math.random(), y: Math.random(), z: Math.random() })),
    handedness: 'Left',
    confidence: 0.85 + Math.random() * 0.15
  }
  coreStore.updateFrame([leftHandData])
}

const simulateRightHand = () =&gt; {
  const rightHandData: HandData = {
    landmarks: Array.from({ length: 21 }, () =&gt; ({ x: Math.random(), y: Math.random(), z: Math.random() })),
    handedness: 'Right',
    confidence: 0.80 + Math.random() * 0.20
  }
  coreStore.updateFrame([rightHandData])
}

const simulateBothHands = () =&gt; {
  const leftHandData: HandData = {
    landmarks: Array.from({ length: 21 }, () =&gt; ({ x: Math.random(), y: Math.random(), z: Math.random() })),
    handedness: 'Left',
    confidence: 0.85 + Math.random() * 0.15
  }
  const rightHandData: HandData = {
    landmarks: Array.from({ length: 21 }, () =&gt; ({ x: Math.random(), y: Math.random(), z: Math.random() })),
    handedness: 'Right',
    confidence: 0.80 + Math.random() * 0.20
  }
  coreStore.updateFrame([leftHandData, rightHandData])
}

const simulateNoHands = () =&gt; {
  coreStore.updateFrame([])
}

const getHandDescription = () =&gt; {
  if (coreStore.bothHands) {
    return 'Deux mains détectées'
  } else if (coreStore.hasLeftHand) {
    return 'Seule la main gauche est détectée'
  } else if (coreStore.hasRightHand) {
    return 'Seule la main droite est détectée'
  }
  return 'État inconnu'
}
&lt;/script&gt;

&lt;style scoped&gt;
.core-store-example {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.example-section {
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
}

.example-section pre {
  background: #2d3748;
  color: #e2e8f0;
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.4;
}

.demo-section {
  background: #ffffff;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
}

.demo-controls {
  display: flex;
  gap: 10px;
  margin: 15px 0;
  flex-wrap: wrap;
}

.demo-controls button {
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  background: #007bff;
  color: white;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.demo-controls button:hover:not(:disabled) {
  background: #0056b3;
  transform: translateY(-1px);
}

.demo-controls button:disabled {
  background: #6c757d;
  cursor: not-allowed;
  opacity: 0.6;
}

.demo-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.info-item {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 6px;
  border-left: 4px solid #007bff;
}

.info-item strong {
  display: block;
  margin-bottom: 8px;
  color: #495057;
}

.info-item ul {
  margin: 0;
  padding-left: 20px;
  line-height: 1.6;
}

.info-item li {
  color: #6c757d;
  margin-bottom: 4px;
}
&lt;/style&gt;