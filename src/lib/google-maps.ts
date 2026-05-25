/**
 * Static libraries array to prevent "Performance warning! LoadScript has been reloaded unintentionally!"
 * and "Loader must not be called again with different options" errors.
 */
export const GOOGLE_MAPS_LIBRARIES: ("places" | "drawing" | "geometry" | "visualization")[] = ["places", "geometry"];

export const GOOGLE_MAPS_ID = 'google-map-script';
