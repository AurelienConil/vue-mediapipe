/**
 * Liste des préprocesseurs disponibles dans l'application
 * Chaque préprocesseur peut être activé/désactivé dynamiquement
 */

import { BasePreprocessor } from './BasePreprocessor';
import { KalmanFilterPreprocessor } from './KalmanFilterPreprocessor';
import { CenterPreprocessor } from './centerPreprocessors';

// Interface pour décrire un préprocesseur disponible
export interface AvailablePreprocessor {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    instance: BasePreprocessor;
}

// Liste des préprocesseurs disponibles
export const availablePreprocessors: AvailablePreprocessor[] = [
        {
        id: 'center',
        name: 'Center Preprocessor',
        description: 'Center on 0,0,0 origin',
        enabled: true,
        instance: new CenterPreprocessor()
    },
    {
        id: 'kalman-filter',
        name: 'Kalman Filter Preprocessor',
        description: 'Applique un filtre de Kalman pour lisser les mouvements et réduire le bruit',
        enabled: false,
        instance: new KalmanFilterPreprocessor()
    },

    // Ajoutez ici d'autres préprocesseurs au fur et à mesure
];

// Fonction pour créer un nouveau préprocesseur
export function createPreprocessor(preprocessorClass: new () => BasePreprocessor): AvailablePreprocessor {
    const instance = new preprocessorClass();
    return {
        id: instance.id,
        name: instance.name,
        description: instance.getDescription(),
        enabled: false,
        instance: instance
    };
}

// Fonction pour trouver un préprocesseur par son ID
export function findPreprocessorById(id: string): AvailablePreprocessor | undefined {
    return availablePreprocessors.find(p => p.id === id);
}