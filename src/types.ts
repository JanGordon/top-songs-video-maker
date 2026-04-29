import { Song } from "./main";

export interface MusicBrainzRecordingResponse {
  created: string; // ISO 8601 timestamp
  count: number;   // Total number of matches in the database
  offset: number;  // Current starting point for results
  recordings: MusicBrainzRecording[];
}

export interface MusicBrainzRecording {
  id: string;      // The MusicBrainz ID (MBID)
  score: number;   // Relevance score from 0-100
  title: string;
  length?: number; // Duration in milliseconds
  video?: boolean;
  "artist-credit"?: ArtistCredit[];
  releases?: ReleaseBrief[];
  // Other fields like 'isrcs' or 'tags' can appear if included in query
}

export interface ArtistCredit {
  name: string;
  artist: {
    id: string;
    name: string;
    "sort-name": string;
    disambiguation?: string;
  };
  joinphrase?: string; // e.g., " & " or " feat. "
}

export interface ReleaseBrief {
  id: string;
  title: string;
  "status"?: string; // e.g., "Official"
  "release-group"?: {
    id: string;
    "primary-type"?: string; // e.g., "Album", "Single"
  };
}


export type Suggestion = Song