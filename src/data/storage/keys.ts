export const STORAGE_PREFIX = 'tbt:v1:';
export const STORAGE_NAMESPACE = STORAGE_PREFIX;

export const STORAGE_KEYS = {
  USERS: `${STORAGE_PREFIX}users`,
  GROUPS: `${STORAGE_PREFIX}groups`,
  TASKS: `${STORAGE_PREFIX}tasks`,
  TAGS: `${STORAGE_PREFIX}tags`,
  NOTIFICATIONS: `${STORAGE_PREFIX}notifications`,
  SESSION: `${STORAGE_PREFIX}session`,
  RECOVERY_CODES: `${STORAGE_PREFIX}recovery_codes`,
  LOGIN_LOCKOUTS: `${STORAGE_PREFIX}login_lockouts`,
} as const;
