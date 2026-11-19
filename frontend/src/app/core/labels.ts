import { ServiceType } from './api/api.types';

/** Arabic UI labels for service types (used by the legend, popups, and later the command bar). */
export const SERVICE_LABELS: Record<ServiceType, string> = {
  school: 'مدارس',
  health: 'صحة',
  park: 'حدائق',
};

/** Singular labels for one facility. */
export const SERVICE_LABEL_SINGULAR: Record<ServiceType, string> = {
  school: 'مدرسة',
  health: 'مرفق صحي',
  park: 'حديقة',
};

/** OSM subtype values -> Arabic. Unknown values fall back to the raw OSM tag. */
export const SUBTYPE_LABELS: Record<string, string> = {
  school: 'مدرسة',
  hospital: 'مستشفى',
  clinic: 'عيادة',
  doctors: 'عيادة أطباء',
  park: 'حديقة عامة',
};

export const NO_NAME = 'بدون اسم';
