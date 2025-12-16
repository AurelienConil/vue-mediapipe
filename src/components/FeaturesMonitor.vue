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
          <span class="feature-name text-caption">{{
            formatFeatureName(feature.name)
          }}</span>
          <v-spacer />
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
import { FeatureStore } from "../stores/FeatureStore";
import FeatureChart from "./FeatureChart.vue";
import FeatureNumberDisplay from "./FeatureNumberDisplay.vue";

// Props
interface Props {
  featureStore: FeatureStore;
  processorVersion?: number;
}
const props = defineProps<Props>();

// Reactive data
const features = ref<Map<string, Feature>>(new Map());
const totalFeatures = ref(0);

// Système de filtrage
type CategoryFilter = "all" | "favorites" | string; // string pour les catégories spécifiques
const selectedCategory = ref<CategoryFilter>("all");

// Options de filtrage par catégories
const categoryOptions = computed(() => {
  const options = [
    { label: "Aucun filtre", value: "all", icon: "mdi-view-list" },
    { label: "Favoris", value: "favorites", icon: "mdi-star" },
  ];

  // Ajouter les catégories disponibles
  const categories = new Set<string>();
  for (const [, feature] of features.value) {
    if (feature.parents) {
      categories.add(feature.parents);
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
const availableCategories = computed(() => {
  const categories = new Set<string>();
  for (const [, feature] of features.value) {
    if (feature.parents) {
      categories.add(feature.parents);
    }
  }
  return Array.from(categories).sort();
});

// Système de favoris
const favorites = ref<Set<string>>(new Set());

// Removed canvas management - now handled by dedicated components

// Computed pour les features filtrées
const filteredFeatures = computed(() => {
  const filtered = new Map<string, Feature>();
  let totalProcessed = 0;
  let fingersFiltered = 0;
  let categoryFiltered = 0;

  for (const [key, feature] of features.value) {
    totalProcessed++;
    let shouldInclude = true;
    let filterReason = "";

    // Filtre par doigts (toujours appliqué)
    if (feature.finger && !selectedFingers.value.has(feature.finger)) {
      shouldInclude = false;
      filterReason = `finger ${feature.finger} not selected`;
      fingersFiltered++;
    }

    // Filtre par catégorie (si sélectionné)
    if (shouldInclude && selectedCategory.value !== "all") {
      if (selectedCategory.value === "favorites") {
        if (!favorites.value.has(key)) {
          shouldInclude = false;
          filterReason = "not in favorites";
          categoryFiltered++;
        }
      } else {
        // Catégorie spécifique
        if (feature.parents !== selectedCategory.value) {
          shouldInclude = false;
          filterReason = `category ${feature.parents} != ${selectedCategory.value}`;
          categoryFiltered++;
        }
      }
    }

    if (shouldInclude) {
      filtered.set(key, feature);
    }
  }

  // Debug logging (throttled)
  if (totalProcessed > 0 && Math.random() < 0.1) {
    // Log ~10% of the time for better debugging
    console.log(
      `🔍 Filtering summary: ${filtered.size}/${totalProcessed} features shown`
    );
    console.log(`   - ${fingersFiltered} filtered by fingers`);
    console.log(`   - ${categoryFiltered} filtered by category`);
    console.log(`   - Selected fingers:`, Array.from(selectedFingers.value));
    console.log(`   - Selected category:`, selectedCategory.value);

    if (filtered.size > 0) {
      console.log(
        `   - First few filtered features:`,
        Array.from(filtered.keys()).slice(0, 3)
      );
      // Show sample feature structure
      const [firstKey, firstFeature] = Array.from(filtered.entries())[0];
      console.log(`   - Sample feature structure:`, {
        key: firstKey,
        name: firstFeature.name,
        display: firstFeature.display,
        value: firstFeature.value,
        type: firstFeature.type,
      });
    } else {
      console.log(`   - No features passed filters!`);
      if (totalProcessed > 0) {
        console.log(
          `   - All features summary:`,
          Array.from(features.value.entries())
            .slice(0, 3)
            .map(([key, f]) => ({
              key,
              name: f.name,
              finger: f.finger,
              display: f.display,
            }))
        );
      }
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

// Update features from store
const updateFeatures = () => {
  console.log("🔄 About to get features from store...");
  console.log("🏪 FeatureStore:", props.featureStore);
  console.log(
    "🏪 FeatureStore methods:",
    Object.getOwnPropertyNames(Object.getPrototypeOf(props.featureStore))
  );

  const newFeatures = props.featureStore.getAllFeatures();
  console.log("🔄 Features retrieved from store:", newFeatures.size);

  if (newFeatures.size > 0) {
    console.log(
      "📋 First few features:",
      Array.from(newFeatures.entries()).slice(0, 3)
    );
  } else {
    console.log("⚠️ No features found in store");
    console.log("🔍 Checking if processor has processed any data...");
  }

  features.value = newFeatures;
  totalFeatures.value = newFeatures.size;
};

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

// Polling interval
let pollInterval: number | null = null;
let isMounted = false;

// Watcher pour réinitialiser lorsque le processor change
watch(
  () => props.processorVersion,
  () => {
    console.log("Processor changé, réinitialisation du FeaturesMonitor");
    // Forcer la mise à jour des features
    updateFeatures();

    // Recharger les favoris depuis localStorage
    loadFavorites();
  }
);

// Graph rendering is now handled by individual FeatureGraphDisplay components

onMounted(() => {
  isMounted = true;
  updateFeatures();
  loadFavorites();

  console.log("🚀 FeaturesMonitor mounted");
  console.log("📊 Initial features count:", features.value.size);
  console.log("🔍 Initial filtered features:", filteredFeatures.value.size);

  // Polling optimisé - ne met à jour que les features visibles
  let lastVisibleFeatureKeys = new Set<string>();

  pollInterval = window.setInterval(() => {
    try {
      // Vérifier que le composant existe encore et que le store est disponible
      if (!isMounted || !props.featureStore || !features.value) {
        if (!isMounted) {
          console.warn("Composant démonté, arrêt du polling");
        } else {
          console.warn(
            "FeatureStore ou features non disponible, arrêt du polling"
          );
        }
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
        return;
      }

      // 1. Récupérer toutes les features du store (calculs toujours actifs)
      const allFeatures = props.featureStore.getAllFeatures();

      // 2. Déterminer quelles features sont actuellement visibles
      const currentVisibleKeys = new Set<string>();

      for (const [key, feature] of allFeatures) {
        let shouldInclude = true;

        // Appliquer les mêmes filtres que filteredFeatures
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
          currentVisibleKeys.add(key);
        }
      }

      // 3. Mise à jour optimisée - seulement si nécessaire
      const visibleKeysChanged =
        currentVisibleKeys.size !== lastVisibleFeatureKeys.size ||
        ![...currentVisibleKeys].every((key) =>
          lastVisibleFeatureKeys.has(key)
        );

      if (visibleKeysChanged || features.value.size !== allFeatures.size) {
        // Créer une Map avec seulement les features visibles pour optimiser le rendu Vue
        const optimizedFeatures = new Map<string, Feature>();

        for (const key of currentVisibleKeys) {
          const feature = allFeatures.get(key);
          if (feature) {
            optimizedFeatures.set(key, feature);
          }
        }

        if (isMounted) {
          features.value = optimizedFeatures; // Seulement les features visibles
          totalFeatures.value = allFeatures.size; // Garder le total complet pour stats
        }

        lastVisibleFeatureKeys = currentVisibleKeys;

        // Debug périodique
        if (Math.random() < 0.02) {
          // 2% du temps
          console.log(
            `🚀 Optimized update: ${optimizedFeatures.size} visible / ${allFeatures.size} total features`
          );
        }
      }

      // Log filtered features every few seconds
      if (Date.now() % 3000 < 100) {
        // Roughly every 3 seconds
        console.log(
          "🔍 Current filtered features:",
          filteredFeatures.value.size,
          "out of",
          totalFeatures.value
        );
        console.log("🎯 Selected fingers:", Array.from(selectedFingers.value));
        console.log("📋 Selected category:", selectedCategory.value);
      }
    } catch (error) {
      console.warn("Erreur dans le polling des features:", error);
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    }
  }, 100); // Reduced frequency since individual components handle their own rendering
});

onUnmounted(() => {
  isMounted = false;
  try {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }

    // Cleanup subscriptions
    for (const unsubscribe of subscriptions.values()) {
      try {
        unsubscribe();
      } catch (error) {
        console.warn("Erreur lors du nettoyage d'une souscription:", error);
      }
    }
    subscriptions.clear();
  } catch (error) {
    console.warn("Erreur lors du démontage de FeaturesMonitor:", error);
  }
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