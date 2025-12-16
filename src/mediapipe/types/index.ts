export interface HandLandmarks {
    x: number;
    y: number;
    z: number;
}

export interface HandData {
    landmarks: HandLandmarks[];
    handedness: HandSide;
    confidence: number;
}

export interface MediaPipeFrame {
    hands: HandData[];
    timestamp: number;
}

// Types pour les doigts
export type Finger = 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';

// Types pour les features
export type FeatureType = 'string' | 'bool' | 'number';
export type FeatureDisplay = 'Number' | 'Graph';
export type HandSide = 'Left' | 'Right';

export interface Feature {
    name: string;
    type: FeatureType;
    value: string | boolean | number;
    parents: string;           // Extracteur qui a généré cette feature
    display?: FeatureDisplay;  // Mode d'affichage
    minMax: [number, number];  // Range pour normalisation/affichage
    timestamp: number;
    hand?: HandSide;          // Quelle main
    finger?: Finger;          // Quel doigt (optionnel)
}

// Types spécialisés pour plus de sécurité de type
export type NumericFeature = Feature & {
    type: 'number';
    value: number;
};

export type BooleanFeature = Feature & {
    type: 'bool';
    value: boolean;
};

export type StringFeature = Feature & {
    type: 'string';
    value: string;
};

export interface Event {
    type: string;
    data: any;
    timestamp: number;
    hand?: 'Left' | 'Right';
}