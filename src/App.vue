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
        <!-- Tous les composants sont montés en permanence mais affichés conditionnellement -->
        
        <!-- Vue Settings: État du système + Préprocesseur -->
        <div v-show="currentView === 'settings'" class="pa-2">
          <v-row no-gutters>
            <v-col cols="6" class="pr-2">
              <CoreStatusMonitor />
            </v-col>
            <v-col cols="6" class="pl-2">
              <PreprocessorControl />
            </v-col>
          </v-row>
        </div>

        <!-- Vue 3D: Squelette 3D + Features -->
        <div v-show="currentView === '3d'" class="pa-2">
          <v-row no-gutters>
            <v-col cols="6" class="pr-2">
              <Preprocessor />
            </v-col>
            <v-col cols="6" class="pl-2">
              <FeaturesMonitor
                :feature-store="mediaPipeStore.getFeatureStore()"
                :processor-version="mediaPipeStore.processorVersion"
              />
            </v-col>
          </v-row>
        </div>

        <!-- Vue Camera: Squelette 3D + Détection de main -->
        <div v-show="currentView === 'camera'" class="pa-2">
          <v-row no-gutters>
            <v-col cols="6" class="pr-2">
              <Preprocessor />
            </v-col>
            <v-col cols="6" class="pl-2">
              <HandDetection />
            </v-col>
          </v-row>
        </div>

        <!-- Vue par défaut: Détection de main + Features -->
        <div v-show="currentView === 'default'" class="pa-2">
          <v-row no-gutters>
            <v-col cols="6" class="pr-2">
              <HandDetection />
            </v-col>
            <v-col cols="6" class="pl-2">
              <FeaturesMonitor
                :feature-store="mediaPipeStore.getFeatureStore()"
                :processor-version="mediaPipeStore.processorVersion"
              />
            </v-col>
          </v-row>
        </div>
      </v-container>
    </v-main>
  </v-app>
</template>

<style scoped>
</style>
