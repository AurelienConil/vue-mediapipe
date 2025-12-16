<script setup lang="ts">
import HandDetection from "./components/HandDetection.vue";
import FeaturesMonitor from "./components/FeaturesMonitor.vue";
import CoreStatusMonitor from "./components/CoreStatusMonitor.vue";
import PreprocessorControl from "./components/PreprocessorControl.vue";
import Preprocessor from "./components/Preprocessor.vue";
import { useMediaPipeStore } from "@/stores/mediapipe";

const mediaPipeStore = useMediaPipeStore();
</script>

<template>
  <v-app>
    <v-app-bar color="primary" dark>
      <v-app-bar-title>
        <v-icon left>mdi-hand-wave</v-icon>
        Vue 3 + MediaPipe - Détection de Main
      </v-app-bar-title>
    </v-app-bar>

    <v-main>
      <v-container fluid>
        <v-row no-gutters class="pa-2">
          <!-- Panneau de contrôle à gauche -->

          <v-col cols="3" class="pr-2">
            <v-row no-gutters>
              <v-col cols="12" class="mb-2">
                <CoreStatusMonitor />
              </v-col>
              <v-col cols="12">
                <PreprocessorControl />
              </v-col>
            </v-row>
          </v-col>

          <!-- Contenu principal -->
          <v-col cols="9" class="pl-2">
            <v-row no-gutters>
              <!-- Première ligne: HandDetection et Preprocessor 3D -->
              <v-col cols="6" class="pr-1 mb-2">
                <HandDetection />
              </v-col>
              <v-col cols="6" class="pl-1 mb-2">
                <Preprocessor />
              </v-col>

              <!-- Deuxième ligne: FeaturesMonitor sur toute la largeur -->
              <v-col cols="12">
                <FeaturesMonitor
                  :feature-store="mediaPipeStore.getFeatureStore()"
                  :processor-version="mediaPipeStore.processorVersion"
                />
              </v-col>
            </v-row>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<style scoped>
</style>
