import type { MediaPipeFrame } from '../types';

export abstract class BasePreprocessor {
    protected enabled = true;
    protected description = 'No description provided';

    abstract readonly name: string;
    abstract readonly id: string; // Identifiant unique pour chaque préprocesseur

    abstract preprocess(frame: MediaPipeFrame): MediaPipeFrame;

    enable(): void {
        this.enabled = true;
        console.log(`${this.name} activé`);
    }

    public disable(): void {
        this.enabled = false;
        console.log(`${this.name} désactivé`);
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    getDescription(): string {
        return this.description;
    }

    setDescription(description: string): void {
        this.description = description;
    }

    reset(): void {
        // Méthode de réinitialisation (à surcharger si nécessaire)
        console.log(`${this.name} réinitialisé`);
    }
}