<template>
  <v-card class="preprocessor-control ma-2" elevation="2">
    <v-card-title class="text-h6">
      <v-icon left>mdi-cog</v-icon>
      Préprocesseurs
    </v-card-title>

    <v-card-text>
      <div class="mb-4">
        <p class="text-body-2 mb-2">
          Activez/désactivez les préprocesseurs pour modifier le traitement des
          données.
        </p>
        <v-alert type="info" density="compact" class="mb-3">
          <template v-slot:prepend>
            <v-icon>mdi-information</v-icon>
          </template>
          <span class="text-caption">
            Les changements sont appliqués immédiatement.
          </span>
        </v-alert>
      </div>

      <div class="preprocessor-list">
        <v-checkbox
          v-for="preprocessor in preprocessors"
          :key="preprocessor.id"
          v-model="preprocessor.enabled"
          :label="preprocessor.name"
          color="primary"
          hide-details
          class="mb-2"
          @update:model-value="
            onPreprocessorToggle(preprocessor.id, preprocessor.enabled)
          "
        >
          <template v-slot:label>
            <div>
              <div>{{ preprocessor.name }}</div>
              <div class="text-caption text-grey">
                {{ preprocessor.description }}
              </div>
            </div>
          </template>
        </v-checkbox>
      </div>

      <v-divider class="my-4" />

      <div class="active-preprocessors-summary">
        <v-chip
          :color="activeCount > 0 ? 'primary' : 'grey'"
          size="small"
          class="mb-2"
        >
          <v-icon left size="small">
            {{ activeCount > 0 ? "mdi-cog" : "mdi-cog-off" }}
          </v-icon>
          {{ activeCount }} préprocesseur{{
            activeCount > 1 ? "s" : ""
          }}
          actif{{ activeCount > 1 ? "s" : "" }}
        </v-chip>

        <div v-if="activeCount > 0" class="mt-2">
          <p class="text-caption mb-1">
            <strong>Actifs:</strong>
          </p>
          <ul class="text-caption">
            <li
              v-for="preprocessor in activePreprocessors"
              :key="preprocessor.id"
            >
              {{ preprocessor.name }}
            </li>
          </ul>
        </div>
      </div>

      <v-divider class="my-4" />

      <div class="actions">
        <v-btn
          @click="resetAllPreprocessors"
          color="grey"
          size="small"
          block
          :disabled="activeCount === 0"
        >
          <v-icon left>mdi-restart</v-icon>
          Réinitialiser tous
        </v-btn>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import {
  availablePreprocessors,
  findPreprocessorById,
  type AvailablePreprocessor,
} from "@/mediapipe/preprocessors/availablePreprocessors";
import { useMediaPipeStore } from "@/stores/mediapipe";

// Liste des préprocesseurs disponibles
const preprocessors = ref<AvailablePreprocessor[]>([]);
const mediaPipeStore = useMediaPipeStore();

// Charger les préprocesseurs au montage
onMounted(() => {
  loadPreprocessors();
  updateProcessorPreprocessors();
});

const loadPreprocessors = () => {
  // Utiliser directement la référence aux préprocesseurs disponibles
  preprocessors.value = availablePreprocessors;
  console.log("Préprocesseurs chargés:", preprocessors.value.length);
};

const onPreprocessorToggle = (id: string, enabled: boolean) => {
  const preprocessor = findPreprocessorById(id);
  if (preprocessor) {
    preprocessor.enabled = enabled;
    console.log(
      `${enabled ? "🎯" : "⏹️"} Préprocesseur ${id} ${
        enabled ? "activé" : "désactivé"
      }`
    );

    // Synchroniser avec le MediaPipeProcessor
    updateProcessorPreprocessors();
  }
};

// Préprocesseurs actifs
const activePreprocessors = computed(() => {
  return preprocessors.value.filter((p) => p.enabled);
});

// Nombre de préprocesseurs actifs
const activeCount = computed(() => {
  return activePreprocessors.value.length;
});

const updateProcessorPreprocessors = () => {
  const processor = mediaPipeStore.getProcessor();
  if (!processor) return;

  // Vider les préprocesseurs actuels
  processor.clearPreprocessors();

  // Ajouter tous les préprocesseurs activés
  availablePreprocessors.forEach((preprocessor) => {
    if (preprocessor.enabled) {
      console.log(`Ajout du préprocesseur: ${preprocessor.name}`);
      processor.addPreprocessor(preprocessor.instance);
    }
  });

  console.log(
    `${
      availablePreprocessors.filter((p) => p.enabled).length
    } préprocesseur(s) configuré(s)`
  );
};

const resetAllPreprocessors = () => {
  // Désactiver tous les préprocesseurs
  preprocessors.value.forEach((p) => {
    p.enabled = false;
  });
  updateProcessorPreprocessors();
  console.log("Tous les préprocesseurs désactivés");
};
</script>

<style scoped>
.preprocessor-control {
  max-width: 400px;
}

.preprocessor-list {
  background: rgba(0, 0, 0, 0.02);
  border-radius: 4px;
}

.v-list-item {
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.v-list-item:last-child {
  border-bottom: none;
}

.active-preprocessors-summary {
  background: rgba(0, 0, 0, 0.05);
  padding: 8px;
  border-radius: 4px;
  border-left: 3px solid v-bind('activeCount > 0 ? "#2196F3" : "#9E9E9E"');
}

ul {
  padding-left: 16px;
  margin: 0;
}
</style>