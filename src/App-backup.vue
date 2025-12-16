<script setup lang="ts">
import { ref, onMounted, nextTick, computed } from "vue";
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
  // Repositionner les composants après le changement de vue
  nextTick(() => {
    positionComponents();
  });
};

// Configuration des composants par vue
const viewComponents = {
  default: [
    { component: "HandDetection", position: "left" },
    { component: "FeaturesMonitor", position: "right" },
  ],
  settings: [
    { component: "CoreStatusMonitor", position: "left" },
    { component: "PreprocessorControl", position: "right" },
  ],
  "3d": [
    { component: "Preprocessor", position: "left" },
    { component: "FeaturesMonitor", position: "right" },
  ],
  camera: [
    { component: "Preprocessor", position: "left" },
    { component: "HandDetection", position: "right" },
  ],
};

// Fonction pour obtenir le style de positionnement des composants
const getComponentStyle = (componentName: string) => {
  const activeComponents = viewComponents[currentView.value] || [];
  const isActive = activeComponents.some((c) => c.component === componentName);

  if (!isActive) {
    return "display: none; position: absolute; top: -9999px;";
  }

  return "position: absolute; z-index: 10;";
};

// Fonction pour positionner physiquement les composants
const positionComponents = () => {
  const activeComponents = viewComponents[currentView.value] || [];

  // D'abord cacher tous les composants
  const allComponents = [
    "HandDetection",
    "FeaturesMonitor",
    "Preprocessor",
    "CoreStatusMonitor",
    "PreprocessorControl",
  ];

  allComponents.forEach((componentName) => {
    const element = document.querySelector(
      `.${componentName.toLowerCase()}-component`
    );
    if (element) {
      element.style.display = "none";
    }
  });

  // Ensuite positionner les composants actifs
  activeComponents.forEach(({ component, position }) => {
    const componentElement = document.querySelector(
      `.${component.toLowerCase()}-component`
    );
    const targetCol = document.querySelector(`[data-component="${component}"]`);

    if (componentElement && targetCol) {
      const rect = targetCol.getBoundingClientRect();
      const containerRect = targetCol
        .closest(".v-container")
        .getBoundingClientRect();

      componentElement.style.display = "block";
      componentElement.style.position = "absolute";
      componentElement.style.left = `${rect.left - containerRect.left}px`;
      componentElement.style.top = `${rect.top - containerRect.top}px`;
      componentElement.style.width = `${rect.width}px`;
    }
  });
};

onMounted(() => {
  // Positionner les composants après le montage initial
  nextTick(() => {
    positionComponents();
  });
});
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
        <!-- INSTANCES UNIQUES - Toujours montées, positionnées par CSS -->
        <HandDetection
          :style="getComponentStyle('HandDetection')"
          class="unique-component hand-detection-component"
        />
        <FeaturesMonitor
          :feature-store="mediaPipeStore.getFeatureStore()"
          :processor-version="mediaPipeStore.processorVersion"
          :style="getComponentStyle('FeaturesMonitor')"
          class="unique-component features-monitor-component"
        />
        <Preprocessor
          :style="getComponentStyle('Preprocessor')"
          class="unique-component preprocessor-component"
        />
        <CoreStatusMonitor
          :style="getComponentStyle('CoreStatusMonitor')"
          class="unique-component core-status-component"
        />
        <PreprocessorControl
          :style="getComponentStyle('PreprocessorControl')"
          class="unique-component preprocessor-control-component"
        />

        <!-- LAYOUT CONTAINERS - Uniquement les grilles -->
        <div class="pa-2">
          <!-- Vue Settings: État du système + Préprocesseur -->
          <v-row
            v-show="currentView === 'settings'"
            no-gutters
            class="layout-row"
          >
            <v-col
              cols="6"
              class="pr-2 layout-col"
              data-component="CoreStatusMonitor"
            >
              <!-- CoreStatusMonitor sera positionné ici -->
            </v-col>
            <v-col
              cols="6"
              class="pl-2 layout-col"
              data-component="PreprocessorControl"
            >
              <!-- PreprocessorControl sera positionné ici -->
            </v-col>
          </v-row>

          <!-- Vue 3D: Squelette 3D + Features -->
          <v-row v-show="currentView === '3d'" no-gutters class="layout-row">
            <v-col
              cols="6"
              class="pr-2 layout-col"
              data-component="Preprocessor"
            >
              <!-- Preprocessor sera positionné ici -->
            </v-col>
            <v-col
              cols="6"
              class="pl-2 layout-col"
              data-component="FeaturesMonitor"
            >
              <!-- FeaturesMonitor sera positionné ici -->
            </v-col>
          </v-row>

          <!-- Vue Camera: Squelette 3D + Détection de main -->
          <v-row
            v-show="currentView === 'camera'"
            no-gutters
            class="layout-row"
          >
            <v-col
              cols="6"
              class="pr-2 layout-col"
              data-component="Preprocessor"
            >
              <!-- Preprocessor sera positionné ici -->
            </v-col>
            <v-col
              cols="6"
              class="pl-2 layout-col"
              data-component="HandDetection"
            >
              <!-- HandDetection sera positionné ici -->
            </v-col>
          </v-row>

          <!-- Vue par défaut: Détection de main + Features -->
          <v-row
            v-show="currentView === 'default'"
            no-gutters
            class="layout-row"
          >
            <v-col
              cols="6"
              class="pr-2 layout-col"
              data-component="HandDetection"
            >
              <!-- HandDetection sera positionné ici -->
            </v-col>
            <v-col
              cols="6"
              class="pl-2 layout-col"
              data-component="FeaturesMonitor"
            >
              <!-- FeaturesMonitor sera positionné ici -->
            </v-col>
          </v-row>
        </div>
      </v-container>
    </v-main>
  </v-app>
</template>

<style scoped>
/* Conteneur principal avec position relative */
.v-container {
  position: relative;
}

/* Composants uniques positionnés absolument */
.unique-component {
  position: absolute;
  z-index: 10;
  transition: none;
}

/* Colonnes layout pour référence de position */
.layout-col {
  position: relative;
  min-height: 400px; /* Hauteur minimale pour les colonnes */
}

/* S'assurer que les transitions sont fluides */
.pa-2 {
  transition: none;
}

/* Éviter le flash lors du changement de vues */
[v-show] {
  transition: none !important;
}

/* Debug - optionnel, retirer en production */
.layout-col {
  border: 1px dashed rgba(0,0,0,0.1);
}
</style>
