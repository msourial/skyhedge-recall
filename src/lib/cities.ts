export const cities = [
  {
    id: 'nyc',
    name: 'New York',
    station: 'USW00094728',
    latitude: 40.7789,
    longitude: -73.9692,
    timezone: 'America/New_York',
  },
  {
    id: 'chicago',
    name: 'Chicago',
    station: 'USW00094846',
    latitude: 41.995,
    longitude: -87.9336,
    timezone: 'America/Chicago',
  },
  {
    id: 'seattle',
    name: 'Seattle',
    station: 'USW00024233',
    latitude: 47.4444,
    longitude: -122.3139,
    timezone: 'America/Los_Angeles',
  },
] as const;
/** Configured NOAA station and forecast location; latitude/longitude are decimal degrees. */
export type City = (typeof cities)[number];
export const sources = ['gfs_seamless', 'ecmwf_ifs025', 'icon_seamless', 'gem_seamless'] as const;
/** Open-Meteo model identifier, used consistently across scores and memories. */
export type Source = (typeof sources)[number];
export const sourceNames: Record<Source, string> = {
  gfs_seamless: 'GFS (NOAA)',
  ecmwf_ifs025: 'ECMWF IFS',
  icon_seamless: 'DWD ICON',
  gem_seamless: 'ECCC GEM',
};
export const thresholds = [10, 25, 50] as const;
