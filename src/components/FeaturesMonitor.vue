<template>
  <v-card
    class="features-monitor pa-2"
    max-width="300"
    height="100%"
    style="overflow-y: auto"
  >
    <v-card-title class="pa-1 text-caption">
      Features Monitor
      <v-spacer />
      <v-chip size="x-small" color="primary"
        >{{ filteredFeatures.size }}/{{ totalFeatures }}</v-chip
      >
    </v-card-title>

    <!-- Contrôles de filtrage -->
    <div class="pa-2">
      <!-- Filtre par catégories -->
      <v-select
        v-model="selectedCategory"
        :items="categoryOptions"
        item-title="label"
        item-value="value"
        density="compact"
        variant="outlined"
        hide-details
        class="mb-2"
        label="Filtrer par catégorie"
        @update:menu="
          (open) => {
            if (open) refreshCategories();
          }
        "
      >
        <template v-slot:selection="{ item }">
          <v-icon size="x-small" class="mr-1">{{ item.raw.icon }}</v-icon>
          <span class="text-caption">{{ item.raw.label }}</span>
        </template>
        <template v-slot:item="{ props, item }">
          <v-list-item v-bind="props">
            <template v-slot:prepend>
              <v-icon size="small">{{ item.raw.icon }}</v-icon>
            </template>
          </v-list-item>
        </template>
      </v-select>

      <!-- Filtre par doigts (toujours visible) -->
      <div class="filter-chips">
        <div class="text-caption mb-1">Doigts:</div>
        <div class="d-flex flex-wrap ga-1">
          <v-chip
            v-for="finger in availableFingers"
            :key="finger"
            size="small"
            :color="selectedFingers.has(finger) ? 'primary' : 'grey'"
            :variant="selectedFingers.has(finger) ? 'flat' : 'outlined'"
            clickable
            @click="toggleFinger(finger)"
          >
            <v-icon size="x-small" class="mr-1">
              {{ getFingerIcon(finger) }}
            </v-icon>
            {{ getFingerLabel(finger) }}
          </v-chip>
        </div>
      </div>
    </div>

    <v-divider />

    <div class="features-grid mt-1">
      <div
        v-for="[key, feature] in filteredFeatures"
        :key="key"
        class="feature-item mb-1"
      >
        <!-- Feature Header -->
        <div class="feature-header d-flex align-center">
          <v-icon :color="getFeatureColor(feature)" size="x-small" class="mr-1">
            {{ getFeatureIcon(feature) }}
          </v-icon>
          <Tooltip
            :content="feature.name"
            :delay="500"
             placement="top-start">
            <span class="feature-name text-caption">{{
              formatFeatureName(feature.name)
            }}</span>
          <v-spacer />
         </Tooltip>
          <v-btn
            :icon="favorites.has(key) ? 'mdi-star' : 'mdi-star-outline'"
            :color="favorites.has(key) ? 'yellow-darken-3' : 'grey'"
            size="x-small"
            variant="text"
            density="compact"
            @click="toggleFavorite(key)"
            class="favorite-btn"
          ></v-btn>
          <v-chip
            v-if="feature.hand"
            size="x-small"
            :color="feature.hand === 'Left' ? 'blue' : 'orange'"
            class="ml-1"
          >
            {{ feature.hand[0] }}
          </v-chip>
        </div>

        <!-- Feature Display -->
        <div class="feature-display mt-1">
          <!-- Number Display -->
          <FeatureNumberDisplay
            v-if="feature.display === 'Number' || !feature.display"
            :feature="feature"
          />

          <!-- Graph Display -->
          <FeatureChart
            v-else-if="feature.display === 'Graph'"
            :feature="feature"
            :feature-key="key"
            :width="250"
            :height="30"
          />
        </div>
      </div>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from "vue";
import type { Feature, Finger } from "../mediapipe/types";
import { useFeatureStore } from "../stores/FeatureStore";
import FeatureChart from "./FeatureChart.vue";
import FeatureNumberDisplay from "./FeatureNumberDisplay.vue";
import type { Tooltip } from "chart.js";

// Props
// On n'utilise plus de prop featureStore, on accède directement au store Pinia
const featureStore = useFeatureStore();
const props = defineProps<{ processorVersion?: number }>();

// Utilisation directe du store Pinia (FeatureStore)
// On utilise un computed pour accéder aux features du store dynamiquement
const storeFeatures = computed(() => featureStore.getAllFeatures());
const totalFeatures = computed(() => storeFeatures.value?.size || 0);

// Système de filtrage
type CategoryFilter = "all" | "favorites" | string; // string pour les catégories spécifiques
const selectedCategory = ref<CategoryFilter>("all");

// Catégories dynamiques, toujours à jour grâce à la réactivité
const categoryOptions = computed(() => {
  const options = [
    { label: "Aucun filtre", value: "all", icon: "mdi-view-list" },
    { label: "Favoris", value: "favorites", icon: "mdi-star" },
  ];
  const categories = new Set<string>();
  if (storeFeatures.value) {
    for (const [, feature] of storeFeatures.value) {
      if (feature.parents) {
        categories.add(feature.parents);
      }
    }
  }
  for (const category of Array.from(categories).sort()) {
    options.push({
      label: formatCategoryName(category),
      value: category,
      icon: getCategoryIcon(category),
    });
  }
  return options;
});

// Rafraîchir au montage
onMounted(() => {
  loadFavorites();
  console.log("🚀 FeaturesMonitor mounted");
  console.log("📊 Initial features count:", totalFeatures.value);
  console.log("🔍 Initial filtered features:", filteredFeatures.value.size);
});

// Filtrage par doigts
const availableFingers: Finger[] = [
  "thumb",
  "index",
  "middle",
  "ring",
  "pinky",
];
const selectedFingers = ref<Set<Finger>>(new Set(availableFingers)); // Tous sélectionnés par défaut

// Filtrage par catégories (pour compatibilité avec l'ancien code)
// const availableCategories = computed(() => {
//   const categories = new Set<string>();
//   for (const [, feature] of features.value) {
//     if (feature.parents) {
//       categories.add(feature.parents);
//     }
//   }
//   return Array.from(categories).sort();
// });

// Système de favoris
const favorites = ref<Set<string>>(new Set());

// Removed canvas management - now handled by dedicated components

// Computed pour les features filtrées (directement depuis le store)
const filteredFeatures = computed(() => {
  const filtered = new Map<string, Feature>();
  const allFeatures = storeFeatures.value;
  if (!allFeatures) return filtered;
  for (const [key, feature] of allFeatures) {
    let shouldInclude = true;
    if (feature.finger && !selectedFingers.value.has(feature.finger)) {
      shouldInclude = false;
    }
    if (shouldInclude && selectedCategory.value !== "all") {
      if (selectedCategory.value === "favorites") {
        if (!favorites.value.has(key)) {
          shouldInclude = false;
        }
      } else {
        if (feature.parents !== selectedCategory.value) {
          shouldInclude = false;
        }
      }
    }
    if (shouldInclude) {
      filtered.set(key, feature);
    }
  }
  return filtered;
});

// Méthodes pour le filtrage
const toggleFinger = (finger: Finger) => {
  if (selectedFingers.value.has(finger)) {
    selectedFingers.value.delete(finger);
  } else {
    selectedFingers.value.add(finger);
  }
  // Déclencher la réactivité
  selectedFingers.value = new Set(selectedFingers.value);
};

const toggleFavorite = (featureKey: string) => {
  const wasInFavorites = favorites.value.has(featureKey);

  if (wasInFavorites) {
    favorites.value.delete(featureKey);
    console.log("⭐ Retiré des favoris:", featureKey);
  } else {
    favorites.value.add(featureKey);
    console.log("⭐ Ajouté aux favoris:", featureKey);
  }

  // Déclencher la réactivité
  favorites.value = new Set(favorites.value);

  // Sauvegarder les favoris dans localStorage
  saveFavorites();
};

const saveFavorites = () => {
  const favoritesArray = Array.from(favorites.value);
  localStorage.setItem("featuresFavorites", JSON.stringify(favoritesArray));
  console.log("💾 Favoris sauvegardés:", favoritesArray);
};

const loadFavorites = () => {
  try {
    const saved = localStorage.getItem("featuresFavorites");
    if (saved) {
      const parsedFavorites = JSON.parse(saved);
      favorites.value = new Set(parsedFavorites);
      console.log("📂 Favoris chargés:", parsedFavorites);
    } else {
      console.log("📂 Aucun favori sauvegardé trouvé");
    }
  } catch (error) {
    console.warn("❌ Erreur lors du chargement des favoris:", error);
  }
};

const getFingerIcon = (finger: Finger): string => {
  const icons = {
    thumb: "mdi-hand-okay",
    index: "mdi-hand-pointing-up",
    middle: "mdi-hand-peace",
    ring: "mdi-hand-heart",
    pinky: "mdi-hand-wave",
  };
  return icons[finger] || "mdi-hand";
};

const getFingerLabel = (finger: Finger): string => {
  const labels = {
    thumb: "Pouce",
    index: "Index",
    middle: "Majeur",
    ring: "Annulaire",
    pinky: "Auriculaire",
  };
  return labels[finger] || finger;
};

const getCategoryIcon = (category: string): string => {
  // Icônes basées sur les noms des extracteurs
  if (category.toLowerCase().includes("distance")) return "mdi-ruler";
  if (
    category.toLowerCase().includes("velocity") ||
    category.toLowerCase().includes("accel")
  )
    return "mdi-speedometer";
  if (
    category.toLowerCase().includes("orientation") ||
    category.toLowerCase().includes("angle")
  )
    return "mdi-rotate-3d";
  if (
    category.toLowerCase().includes("size") ||
    category.toLowerCase().includes("normalize")
  )
    return "mdi-resize";
  return "mdi-cog";
};

const formatCategoryName = (category: string): string => {
  return category
    .replace(/([A-Z])/g, " $1")
    .trim()
    .replace(/^./, (str) => str.toUpperCase());
};

// Suppression de updateFeatures : la réactivité du store Pinia suffit

// Subscribe to all feature changes
const subscriptions = new Map<string, () => void>();

const subscribeToFeature = (featureName: string) => {
  const unsubscribe = () => {
    // TODO: Implement unsubscribe when FeatureStore has it
  };

  // For now, we'll poll the store periodically
  subscriptions.set(featureName, unsubscribe);
};

// Format feature name for display
const formatFeatureName = (name: string): string => {
  return name
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .trim();
};

// Helper functions for feature display in the header
const getFeatureColor = (feature: Feature): string => {
  switch (feature.type) {
    case "number":
      if (typeof feature.value === "number") {
        const [min, max] = feature.minMax;
        const range = max - min;
        if (range === 0) return "blue";
        const normalized = ((feature.value - min) / range) * 100;
        if (normalized > 80) return "red";
        if (normalized > 60) return "orange";
        if (normalized > 40) return "yellow";
        return "green";
      }
      return "blue";
    case "bool":
      return feature.value ? "green" : "red";
    default:
      return "grey";
  }
};

// Get feature icon
const getFeatureIcon = (feature: Feature): string => {
  if (feature.name.includes("velocity")) return "mdi-speedometer";
  if (feature.name.includes("acceleration")) return "mdi-rocket";
  if (feature.name.includes("angle")) return "mdi-angle-acute";
  if (feature.name.includes("distance")) return "mdi-ruler";
  return "mdi-chart-line";
};

// Graph rendering is now handled by FeatureGraphDisplay component

// Suppression du polling interval et de isMounted

// Watcher pour recharger les favoris si le processor change
watch(
  () => props.processorVersion,
  () => {
    console.log("Processor changé, rechargement des favoris");
    loadFavorites();
  }
);

onMounted(() => {
  loadFavorites();
  console.log("🚀 FeaturesMonitor mounted");
  console.log("📊 Initial features count:", totalFeatures.value);
  console.log("🔍 Initial filtered features:", filteredFeatures.value.size);
});

onUnmounted(() => {
  // Cleanup subscriptions si besoin (placeholder)
  subscriptions.clear();
});
</script>

<style scoped>
.features-monitor {
  font-size: 11px;
}

.features-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.feature-item {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 4px;
  background: rgba(0, 0, 0, 0.1);
}

.feature-header {
  min-height: 16px;
}

.feature-name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}

.number-display {
  height: 12px;
}

.graph-display {
  height: 30px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  overflow: hidden;
}

/* Graph styles moved to FeatureGraphDisplay component */

.filter-chips {
  margin-top: 8px;
}

.favorite-btn {
  min-width: 20px !important;
  width: 20px;
  height: 20px;
}
</style>