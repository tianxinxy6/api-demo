export const PUBLIC_KEY = '__public_key__';

export const PUBLIC_ADMIN_KEY = '__public_admin_key__';

export const AuthStrategy = {
  LOCAL: 'local',
  LOCAL_EMAIL: 'local_email',
  LOCAL_PHONE: 'local_phone',

  JWT: 'jwt',

  GITHUB: 'github',
  GOOGLE: 'google',
} as const;
