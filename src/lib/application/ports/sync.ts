/**
 * Sync port contracts — interfaces only, no implementation yet.
 *
 * These define the boundary for a future remote sync provider
 * (e.g., Firebase, Supabase, custom REST API). The application
 * layer will orchestrate sync through these ports without knowing
 * the remote provider.
 */

import type { PersistedAppData, SiteSettings } from '$lib/domain/models';

/** Metadata attached to a synced record for conflict resolution. */
export interface SyncMetadata {
	/** ISO 8601 timestamp of last modification. */
	updatedAt: string;
	/** Monotonically increasing version counter per record. */
	version: number;
	/** Identifier of the device/client that made the change. */
	sourceId: string;
}

/** A record wrapped with sync metadata. */
export interface SyncEnvelope<T> {
	data: T;
	sync: SyncMetadata;
}

/** Conflict detected during sync — both local and remote changed. */
export interface SyncConflict<T> {
	local: SyncEnvelope<T>;
	remote: SyncEnvelope<T>;
}

/** Strategy for resolving a conflict. */
export type ConflictResolution = 'local-wins' | 'remote-wins' | 'manual';

/** Result of a sync operation. */
export interface SyncResult {
	ok: boolean;
	pushed: number;
	pulled: number;
	conflicts: number;
}

/**
 * Remote sync provider port.
 * Implementations handle the actual network communication.
 */
export interface SyncProvider {
	/** Push local state to remote. */
	pushAppData(data: SyncEnvelope<PersistedAppData>): Promise<SyncResult>;

	/** Pull remote state and return it. */
	pullAppData(): Promise<SyncEnvelope<PersistedAppData> | null>;

	/** Push admin settings to remote. */
	pushSettings(settings: SyncEnvelope<SiteSettings>): Promise<SyncResult>;

	/** Pull admin settings from remote. */
	pullSettings(): Promise<SyncEnvelope<SiteSettings> | null>;

	/** Check connectivity to the remote service. */
	isOnline(): Promise<boolean>;
}

/**
 * Conflict resolver port.
 * Determines how to handle conflicting changes.
 */
export interface ConflictResolver {
	resolve<T>(conflict: SyncConflict<T>): Promise<{
		resolution: ConflictResolution;
		data: T;
	}>;
}
