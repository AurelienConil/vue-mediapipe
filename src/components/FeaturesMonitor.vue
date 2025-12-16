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
          <div
            v-if="feature.display === 'Number' || !feature.display"
            class="number-display"
          >
            <v-progress-linear
              :model-value="feature.value"
              :color="getFeatureColor(feature)"
              height="12"
              :max="feature.minMax ? feature.minMax[1] : 1"
              rounded
            >
              <template #default="{ value }">
                <small class="text-white">{{
                  formatValue(feature.value)
                }}</small>
              </template>
            </v-progress-linear>
          </div>

          <!-- Graph Display -->
          <div v-else-if="feature.display === 'Graph'" class="graph-display">
            <canvas
              :id="'canvas_' + key"
              width="250"
              height="30"
              class="mini-graph"
            ></canvas>
          </div>
        </div>
      </div>
    </div>
  </v-card>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, computed, watch } from "vue";
import type { Feature, Finger } from "../mediapipe/types";
import { FeatureStore } from "../stores/FeatureStore";

// Props
interface Props {
  featureStore: FeatureStore;
  processorVersion?: number;
}
const props = defineProps<Props>();

// Reactive data
const features = ref<Map<string, Feature>>(new Map());
const totalFeatures = ref(0);
const graphHistory = ref<Map<string, number[]>>(new Map());
const maxHistoryLength = 50; // Nombre de points dans le graphique

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

// Canvas contexts cache
const canvasContexts = new Map<string, CanvasRenderingContext2D>();

// Computed pour les features filtrées
const filteredFeatures = computed(() => {
  const filtered = new Map<string, Feature>();

  for (const [key, feature] of features.value) {
    let shouldInclude = true;

    // Filtre par doigts (toujours appliqué)
    if (feature.finger && !selectedFingers.value.has(feature.finger)) {
      shouldInclude = false;
    }

    // Filtre par catégorie (si sélectionné)
    if (shouldInclude && selectedCategory.value !== "all") {
      if (selectedCategory.value === "favorites") {
        shouldInclude = favorites.value.has(key);
      } else {
        // Catégorie spécifique
        shouldInclude = feature.parents === selectedCategory.value;
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

// Update features from store
const updateFeatures = () => {
  features.value = props.featureStore.getAllFeatures();
  totalFeatures.value = features.value.size;
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

// Format feature value
const formatValue = (value: string | boolean | number): string => {
  if (typeof value === "number") {
    return value.toFixed(3);
  }
  return String(value);
};

// Get normalized value for progress bar (0-100)
const getNormalizedValue = (feature: Feature): number => {
  if (typeof feature.value !== "number") return 0;

  const [min, max] = feature.minMax;
  const normalized = ((feature.value - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, normalized));
};

// Get feature color based on type and value
const getFeatureColor = (feature: Feature): string => {
  switch (feature.type) {
    case "number":
      if (typeof feature.value === "number") {
        const normalized = getNormalizedValue(feature);
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

// Update graph history and redraw
const updateGraph = (key: string, feature: Feature) => {
  if (feature.display !== "Graph" || typeof feature.value !== "number") {
    return;
  }

  // Vérifier que la feature est actuellement visible avant de dessiner
  if (!filteredFeatures.value.has(key)) {
    return;
  }

  // Get or create history array
  let history = graphHistory.value.get(key) || [];
  history.push(feature.value);

  // Limit history length
  if (history.length > maxHistoryLength) {
    history = history.slice(-maxHistoryLength);
  }

  graphHistory.value.set(key, history);

  // Redraw canvas seulement si l'élément existe
  nextTick(() => {
    const canvas = document.getElementById(`canvas_${key}`);
    if (canvas) {
      drawGraph(key, history, feature.minMax);
    }
  });
};

// Draw mini graph on canvas
const drawGraph = (key: string, data: number[], minMax: [number, number]) => {
  const canvas = document.getElementById(`canvas_${key}`) as HTMLCanvasElement;
  if (!canvas) {
    // Canvas pas trouvé - probablement filtré, pas d'erreur
    return;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  if (data.length < 2) return;

  const [min, max] = minMax;
  const range = max - min;

  // Draw grid
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 0.5;
  ctx.setLineDash([2, 2]);

  // Horizontal grid lines
  for (let i = 0; i <= 4; i++) {
    const y = (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Draw line graph
  ctx.strokeStyle = "#2196F3";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.beginPath();

  data.forEach((value, index) => {
    const x = (width / (data.length - 1)) * index;
    const normalizedValue = (value - min) / range;
    const y = height - normalizedValue * height;

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();

  // Draw current value point
  if (data.length > 0) {
    const lastValue = data[data.length - 1];
    const x = width - 2;
    const normalizedValue = (lastValue - min) / range;
    const y = height - normalizedValue * height;

    ctx.fillStyle = "#FF5722";
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, 2 * Math.PI);
    ctx.fill();
  }
};

// Polling interval
let pollInterval: NodeJS.Timeout;

// Watcher pour réinitialiser lorsque le processor change
watch(
  () => props.processorVersion,
  () => {
    console.log("Processor changé, réinitialisation du FeaturesMonitor");
    // Forcer la mise à jour des features
    updateFeatures();

    // Réinitialiser l'historique des graphiques
    graphHistory.value.clear();
    console.log("Historique des graphiques réinitialisé");

    // Recharger les favoris depuis localStorage
    loadFavorites();
  }
);

onMounted(() => {
  updateFeatures();
  loadFavorites();

  // Poll for updates (since we don't have proper subscriptions yet)
  pollInterval = setInterval(() => {
    const newFeatures = props.featureStore.getAllFeatures();

    // Mettre à jour les features d'abord
    features.value = newFeatures;
    totalFeatures.value = newFeatures.size;

    // Check for updates and update graphs (seulement pour les features actuellement affichées)
    for (const [key, feature] of filteredFeatures.value) {
      const oldFeature = features.value.get(key);
      if (!oldFeature || oldFeature.timestamp !== feature.timestamp) {
        updateGraph(key, feature);
      }
    }
  }, 16); // ~60fps
});

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval);
  }

  // Cleanup subscriptions
  for (const unsubscribe of subscriptions.values()) {
    unsubscribe();
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
  background: rgba(0, 0, 0, 0.2);
  border-radius: 2px;
  overflow: hidden;
}

.mini-graph {
  width: 100%;
  height: 100%;
  display: block;
}

.filter-chips {
  margin-top: 8px;
}

.favorite-btn {
  min-width: 20px !important;
  width: 20px;
  height: 20px;
}
</style>