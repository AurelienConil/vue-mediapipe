<script setup lang="ts">
import HandDetection from "./components/HandDetection.vue";
import FeaturesMonitor from "./components/FeaturesMonitor.vue";
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
          <v-col cols="6" class="pr-2 border">
            <HandDetection />
          </v-col>
          <v-col cols="6" class="border">
            <FeaturesMonitor
              :feature-store="mediaPipeStore.getFeatureStore()"
            />
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<style scoped>
</style>
