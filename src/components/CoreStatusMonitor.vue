&lt;template&gt;
  &lt;div class="core-status-monitor"&gt;
    &lt;h3&gt;📊 Core MediaPipe Status&lt;/h3&gt;
    
    &lt;!-- Status général --&gt;
    &lt;div class="status-section"&gt;
      &lt;h4&gt;🎯 Status&lt;/h4&gt;
      &lt;div class="status-grid"&gt;
        &lt;div class="status-item"&gt;
          &lt;span class="label"&gt;Détection:&lt;/span&gt;
          &lt;span :class="{'active': coreStore.status.isDetecting, 'inactive': !coreStore.status.isDetecting}"&gt;
            {{ coreStore.status.isDetecting ? '🟢 Active' : '🔴 Inactive' }}
          &lt;/span&gt;
        &lt;/div&gt;
        &lt;div class="status-item"&gt;
          &lt;span class="label"&gt;FPS:&lt;/span&gt;
          &lt;span class="value"&gt;{{ coreStore.status.fps }} (avg: {{ coreStore.averageFps }})&lt;/span&gt;
        &lt;/div&gt;
        &lt;div class="status-item"&gt;
          &lt;span class="label"&gt;Frames:&lt;/span&gt;
          &lt;span class="value"&gt;{{ coreStore.status.frameCount }}&lt;/span&gt;
        &lt;/div&gt;
        &lt;div class="status-item"&gt;
          &lt;span class="label"&gt;Traitement:&lt;/span&gt;
          &lt;span class="value"&gt;{{ coreStore.status.averageProcessingTime }}ms&lt;/span&gt;
        &lt;/div&gt;
      &lt;/div&gt;
    &lt;/div&gt;

    &lt;!-- Détection des mains --&gt;
    &lt;div class="hands-section"&gt;
      &lt;h4&gt;👐 Détection des Mains&lt;/h4&gt;
      &lt;div class="hands-summary"&gt;
        &lt;div class="hands-count"&gt;
          &lt;span class="label"&gt;Nombre de mains:&lt;/span&gt;
          &lt;span :class="getHandCountClass()"&gt;
            {{ coreStore.handCount }} 
            {{ getHandCountEmoji() }}
          &lt;/span&gt;
        &lt;/div&gt;
        
        &lt;div class="hands-status"&gt;
          &lt;div class="hand-status"&gt;
            &lt;span class="label"&gt;Main gauche:&lt;/span&gt;
            &lt;span :class="{'detected': coreStore.hasLeftHand, 'not-detected': !coreStore.hasLeftHand}"&gt;
              {{ coreStore.hasLeftHand ? '🟢 Détectée' : '⚪ Absente' }}
              {{ coreStore.leftHandInfo ? `(${Math.round(coreStore.leftHandInfo.confidence * 100)}%)` : '' }}
            &lt;/span&gt;
          &lt;/div&gt;
          
          &lt;div class="hand-status"&gt;
            &lt;span class="label"&gt;Main droite:&lt;/span&gt;
            &lt;span :class="{'detected': coreStore.hasRightHand, 'not-detected': !coreStore.hasRightHand}"&gt;
              {{ coreStore.hasRightHand ? '🟢 Détectée' : '⚪ Absente' }}
              {{ coreStore.rightHandInfo ? `(${Math.round(coreStore.rightHandInfo.confidence * 100)}%)` : '' }}
            &lt;/span&gt;
          &lt;/div&gt;
        &lt;/div&gt;
      &lt;/div&gt;

      &lt;!-- Conditions spéciales --&gt;
      &lt;div class="special-conditions" v-if="coreStore.hasHands"&gt;
        &lt;h5&gt;✨ Conditions&lt;/h5&gt;
        &lt;div class="conditions-grid"&gt;
          &lt;div class="condition-item"&gt;
            &lt;span class="label"&gt;Une seule main:&lt;/span&gt;
            &lt;span :class="{'condition-true': coreStore.singleHand, 'condition-false': !coreStore.singleHand}"&gt;
              {{ coreStore.singleHand ? '✅' : '❌' }}
            &lt;/span&gt;
          &lt;/div&gt;
          &lt;div class="condition-item"&gt;
            &lt;span class="label"&gt;Deux mains:&lt;/span&gt;
            &lt;span :class="{'condition-true': coreStore.bothHands, 'condition-false': !coreStore.bothHands}"&gt;
              {{ coreStore.bothHands ? '✅' : '❌' }}
            &lt;/span&gt;
          &lt;/div&gt;
          &lt;div class="condition-item"&gt;
            &lt;span class="label"&gt;Confiance gauche (&gt;70%):&lt;/span&gt;
            &lt;span :class="{'condition-true': coreStore.isHandConfident('Left'), 'condition-false': !coreStore.isHandConfident('Left')}"&gt;
              {{ coreStore.isHandConfident('Left') ? '✅' : '❌' }}
            &lt;/span&gt;
          &lt;/div&gt;
          &lt;div class="condition-item"&gt;
            &lt;span class="label"&gt;Confiance droite (&gt;70%):&lt;/span&gt;
            &lt;span :class="{'condition-true': coreStore.isHandConfident('Right'), 'condition-false': !coreStore.isHandConfident('Right')}"&gt;
              {{ coreStore.isHandConfident('Right') ? '✅' : '❌' }}
            &lt;/span&gt;
          &lt;/div&gt;
        &lt;/div&gt;
      &lt;/div&gt;
    &lt;/div&gt;

    &lt;!-- Erreurs --&gt;
    &lt;div class="error-section" v-if="coreStore.error"&gt;
      &lt;h4&gt;❌ Erreur&lt;/h4&gt;
      &lt;div class="error-message"&gt;
        {{ coreStore.error }}
      &lt;/div&gt;
    &lt;/div&gt;
  &lt;/div&gt;
&lt;/template&gt;

&lt;script setup lang="ts"&gt;
import { useCoreStore } from '@/stores/CoreStore'

const coreStore = useCoreStore()

const getHandCountClass = () =&gt; {
  switch (coreStore.handCount) {
    case 0: return 'count-none'
    case 1: return 'count-one'
    case 2: return 'count-two'
    default: return 'count-multiple'
  }
}

const getHandCountEmoji = () =&gt; {
  switch (coreStore.handCount) {
    case 0: return '🚫'
    case 1: return '👍'
    case 2: return '👏'
    default: return '🤹'
  }
}
&lt;/script&gt;

&lt;style scoped&gt;
.core-status-monitor {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  border-radius: 12px;
  margin: 15px 0;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.core-status-monitor h3 {
  margin: 0 0 20px 0;
  text-align: center;
  font-size: 1.4em;
}

.status-section, .hands-section, .error-section {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 15px;
  margin: 15px 0;
}

.status-section h4, .hands-section h4, .error-section h4 {
  margin: 0 0 12px 0;
  font-size: 1.1em;
}

.status-grid, .conditions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
}

.status-item, .condition-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.1);
  padding: 8px 12px;
  border-radius: 6px;
}

.label {
  font-weight: 600;
  color: #e0e0e0;
}

.value {
  font-weight: bold;
  color: #fff;
}

.active {
  color: #4ade80;
  font-weight: bold;
}

.inactive {
  color: #f87171;
  font-weight: bold;
}

.detected {
  color: #4ade80;
  font-weight: bold;
}

.not-detected {
  color: #d1d5db;
}

.hands-summary {
  margin-bottom: 15px;
}

.hands-count {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-size: 1.1em;
}

.count-none { color: #f87171; }
.count-one { color: #fbbf24; }
.count-two { color: #4ade80; }
.count-multiple { color: #8b5cf6; }

.hands-status {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.hand-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.1);
  padding: 8px 12px;
  border-radius: 6px;
}

.special-conditions h5 {
  margin: 0 0 10px 0;
  font-size: 1em;
  color: #fbbf24;
}

.condition-true {
  color: #4ade80;
}

.condition-false {
  color: #f87171;
}

.error-message {
  background: rgba(248, 113, 113, 0.2);
  border: 1px solid #f87171;
  border-radius: 6px;
  padding: 10px;
  color: #fecaca;
}
&lt;/style&gt;