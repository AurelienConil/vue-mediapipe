<script setup lang="ts">
import { ref } from "vue";
import HandDetection from "./components/HandDetection.vue";
import FeaturesMonitor from "./components/FeaturesMonitor.vue";
import CoreStatusMonitor from "./components/CoreStatusMonitor.vue";
import PreprocessorControl from "./components/PreprocessorControl.vue";
import Preprocessor from "./components/Preprocessor.vue";
import { useMediaPipeStore } from "@/stores/mediapipe";

const mediaPipeStore = useMediaPipeStore();

// Gestion des vues
type ViewType = "default" | "settings" | "3d" | "camera";
const currentView = ref<ViewType>("default");

const views = [
  {
    key: "default",
    label: "Défaut",
    icon: "mdi-view-dashboard",
    tooltip: "Vue par défaut (Main + Features)",
  },
  {
    key: "settings",
    label: "Paramètres",
    icon: "mdi-cog",
    tooltip: "Paramètres (État + Préprocesseur)",
  },
  {
    key: "3d",
    label: "3D",
    icon: "mdi-cube-outline",
    tooltip: "Vue 3D (Squelette + Features)",
  },
  {
    key: "camera",
    label: "Caméra",
    icon: "mdi-camera",
    tooltip: "Vue caméra (Squelette + Détection)",
  },
] as const;

const setView = (view: ViewType) => {
  currentView.value = view;
};
</script>

<template>
  <v-app>
    <v-app-bar color="primary" dark>
      <v-app-bar-title>
        <v-icon left>mdi-hand-wave</v-icon>
        Vue 3 + MediaPipe - Détection de Main
      </v-app-bar-title>

      <v-spacer></v-spacer>

      <!-- Navigation par icônes -->
      <v-btn-toggle
        v-model="currentView"
        color="white"
        variant="outlined"
        divided
      >
        <v-btn
          v-for="view in views"
          :key="view.key"
          :value="view.key"
          @click="setView(view.key as ViewType)"
          variant="text"
          class="mx-1"
        >
          <v-tooltip activator="parent" location="bottom">
            {{ view.tooltip }}
          </v-tooltip>
          <v-icon>{{ view.icon }}</v-icon>
          <span class="ml-2 d-none d-md-inline">{{ view.label }}</span>
        </v-btn>
      </v-btn-toggle>
    </v-app-bar>

    <v-main>
      <v-container fluid>
        <!-- COMPOSANTS UNIQUES - Montés une seule fois avec KeepAlive -->
        <keep-alive>
          <!-- Instance unique de HandDetection -->
          <HandDetection
            v-if="currentView === 'default' || currentView === 'camera'"
            :class="{
              'position-left': currentView === 'default',
              'position-right': currentView === 'camera',
            }"
          />
        </keep-alive>

        <keep-alive>
          <!-- Instance unique de FeaturesMonitor -->
          <FeaturesMonitor
            v-if="currentView === 'default' || currentView === '3d'"
            :feature-store="mediaPipeStore.getFeatureStore()"
            :processor-version="mediaPipeStore.processorVersion"
            :class="{
              'position-right': currentView === 'default',
              'position-right': currentView === '3d',
            }"
          />
        </keep-alive>

        <keep-alive>
          <!-- Instance unique de Preprocessor -->
          <Preprocessor
            v-if="currentView === '3d' || currentView === 'camera'"
            class="position-left"
          />
        </keep-alive>

        <keep-alive>
          <!-- Instance unique de CoreStatusMonitor -->
          <CoreStatusMonitor
            v-if="currentView === 'settings'"
            class="position-left"
          />
        </keep-alive>

        <keep-alive>
          <!-- Instance unique de PreprocessorControl -->
          <PreprocessorControl
            v-if="currentView === 'settings'"
            class="position-right"
          />
        </keep-alive>

        <!-- Grille pour positionner les composants -->
        <div class="layout-grid pa-2">
          <v-row no-gutters>
            <v-col cols="6" class="pr-2 layout-column left-column">
              <!-- Colonne gauche -->
            </v-col>
            <v-col cols="6" class="pl-2 layout-column right-column">
              <!-- Colonne droite -->
            </v-col>
          </v-row>
        </div>
      </v-container>
    </v-main>
  </v-app>
</template>

<style scoped>
.layout-grid {
  position: relative;
}

.layout-column {
  min-height: 500px;
  position: relative;
}

.position-left {
  position: absolute;
  top: 0;
  left: 0;
  width: calc(50% - 8px);
  z-index: 10;
}

.position-right {
  position: absolute;
  top: 0;
  right: 0;
  width: calc(50% - 8px);
  z-index: 10;
}

/* Debug borders - retirer en production */
.layout-column {
  border: 1px dashed rgba(0, 0, 0, 0.1);
}
</style>