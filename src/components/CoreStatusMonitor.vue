<template>
  <v-card class="core-status-monitor ma-2" elevation="2">
    <v-card-title class="text-h6">
      <v-icon left>mdi-monitor</v-icon>
      État du Système
    </v-card-title>

    <v-card-text>
      <div class="status-grid">
        <!-- État général -->
        <div class="status-section">
          <div class="status-header">
            <v-icon left>mdi-information</v-icon>
            <span>Statut</span>
          </div>
          <div class="status-content">
            <v-chip
              :color="coreStore.status.isDetecting ? 'success' : 'grey'"
              size="small"
            >
              {{ coreStore.status.isDetecting ? 'Détection active' : 'En attente' }}
            </v-chip>
          </div>
        </div>

        <!-- FPS -->
        <div class="status-section">
          <div class="status-header">
            <v-icon left>mdi-speedometer</v-icon>
            <span>Performance</span>
          </div>
          <div class="status-content">
            <div class="fps-display">
              <span class="fps-value">{{ coreStore.status.fps }}</span>
              <span class="fps-label">FPS</span>
            </div>
          </div>
        </div>

        <!-- Mains détectées -->
        <div class="status-section">
          <div class="status-header">
            <v-icon left>mdi-hand-wave</v-icon>
            <span>Mains</span>
          </div>
          <div class="status-content">
            <div v-if="coreStore.hasHands" class="hands-display">
              <v-icon v-if="coreStore.hasLeftHand" color="blue" class="mr-1">mdi-hand-left</v-icon>
              <v-icon v-if="coreStore.hasRightHand" color="orange" class="mr-1">mdi-hand-right</v-icon>
              <span>{{ coreStore.handCount }} main{{ coreStore.handCount > 1 ? 's' : '' }}</span>
            </div>
            <div v-else class="no-hands">
              <span>Aucune main détectée</span>
            </div>
          </div>
        </div>

        <!-- Conditions spéciales -->
        <div v-if="coreStore.hasHands" class="special-conditions mt-4">
          <div class="condition-item">
            <v-icon :color="coreStore.bothHands ? 'success' : 'grey'" class="mr-1">
              mdi-handshake
            </v-icon>
            <span>Deux mains: {{ coreStore.bothHands ? '✅' : '❌' }}</span>
          </div>
        </div>
      </div>

      <!-- Détails techniques -->
      <v-expansion-panels class="mt-4 technical-details">
        <v-expansion-panel>
          <v-expansion-panel-title>
            <v-icon left>mdi-cog</v-icon>
            Détails Techniques
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <div class="details-grid">
              <div class="detail-item">
                <span class="detail-label">Frames:</span>
                <span class="detail-value">{{ coreStore.status.frameCount }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">FPS moyen:</span>
                <span class="detail-value">{{ coreStore.averageFps }}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Temps traitement:</span>
                <span class="detail-value">{{ coreStore.status.averageProcessingTime }} ms</span>
              </div>
            </div>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { useCoreStore } from '@/stores/CoreStore';

const coreStore = useCoreStore();
</script>

<style scoped>
.core-status-monitor {
  max-width: 400px;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.status-section {
  background: rgba(0, 0, 0, 0.05);
  padding: 8px;
  border-radius: 4px;
  text-align: center;
}

.status-header {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8em;
  color: rgba(0, 0, 0, 0.6);
  margin-bottom: 4px;
}

.status-content {
  font-weight: 500;
}

.fps-display {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 4px;
}

.fps-value {
  font-size: 1.2em;
  font-weight: bold;
}

.fps-label {
  font-size: 0.8em;
  color: rgba(0, 0, 0, 0.6);
}

.hands-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.no-hands {
  font-size: 0.9em;
  color: rgba(0, 0, 0, 0.6);
}

.special-conditions {
  background: rgba(0, 0, 0, 0.05);
  padding: 8px;
  border-radius: 4px;
}

.condition-item {
  display: flex;
  align-items: center;
  font-size: 0.9em;
  padding: 2px 0;
}

.technical-details {
  margin-top: 12px;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.85em;
}

.detail-label {
  color: rgba(0, 0, 0, 0.6);
}

.detail-value {
  font-weight: 500;
}
</style>