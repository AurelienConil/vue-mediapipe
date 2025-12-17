<script setup lang="ts">
import { ref, computed } from "vue";
import HandDetection from "./components/HandDetection.vue";
import FeaturesMonitor from "./components/FeaturesMonitor.vue";
import CoreStatusMonitor from "./components/CoreStatusMonitor.vue";
import PreprocessorControl from "./components/PreprocessorControl.vue";
import Preprocessor from "./components/Preprocessor.vue";
import { useMediaPipeStore } from "@/stores/mediapipe";
import { useCoreStore } from "@/stores/coreStore";
const coreStore = useCoreStore();
import EventDisplay from "./components/EventDisplay.vue";

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

// Computed properties pour contrôler la visibilité des colonnes

const showHandDetection = computed(
  () => currentView.value === "default" || currentView.value === "camera"
);

const showFeaturesMonitor = computed(
  () => currentView.value === "default" || currentView.value === "3d"
);

const showEventDisplay = computed(
  () => currentView.value === "default"
);
const showPreprocessor = computed(
  () => currentView.value === "3d" || currentView.value === "camera"
);

const showCoreStatus = computed(() => currentView.value === "settings");

const showPreprocessorControl = computed(
  () => currentView.value === "settings"
);
</script>

<template>
  <v-app>
    <v-app-bar color="primary" dark>
      <v-app-bar-title>
        <v-icon left>mdi-hand-wave</v-icon>
        VuePipe 
      </v-app-bar-title>

      <v-spacer></v-spacer>

      {{ coreStore.averageFps.toFixed(1) }} FPS

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
      <v-container fluid class="pa-2">
        <!-- GRILLE SIMPLE : Une colonne par composant -->
        <v-row no-gutters>
          <!-- Colonne 1 : HandDetection -->
          <v-col
            cols="6"
            class="pr-2"
            :style="{ display: showHandDetection ? 'block' : 'none' }"
          >
            <HandDetection />
          </v-col>

          <!-- Colonne 2 : FeaturesMonitor -->
          <v-col
            cols="3"
            class="pl-2"
            :style="{ display: showFeaturesMonitor ? 'block' : 'none' }"
          >
            <FeaturesMonitor
              :feature-store="mediaPipeStore.getFeatureStore()"
              :processor-version="mediaPipeStore.processorVersion"
            />
          </v-col>

          <!-- Colonne 2 : FeaturesMonitor -->
          <v-col
            cols="3"
            class="pl-2"
            :style="{ display: showEventDisplay ? 'block' : 'none' }"
          >
           <EventDisplay />
          </v-col>

          <!-- Colonne 3 : Preprocessor -->
          <v-col
            cols="6"
            class="pr-2"
            v-if="showPreprocessor"
          >
            <Preprocessor />
          </v-col>

          <!-- Colonne 4 : CoreStatusMonitor -->
          <v-col
            cols="6"
            class="pr-2"
            :style="{ display: showCoreStatus ? 'block' : 'none' }"
          >
            <CoreStatusMonitor />
          </v-col>

          <!-- Colonne 5 : PreprocessorControl -->
          <v-col
            cols="6"
            class="pl-2"
            :style="{ display: showPreprocessorControl ? 'block' : 'none' }"
          >
            <PreprocessorControl />
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<style scoped>
/* Rien de spécial, juste du layout basique */
.v-col {
  transition: none;
}
</style>