const COMMON_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password1",
  "password123",
  "qwerty123",
  "qwertyui",
  "11111111",
  "00000000",
  "1q2w3e4r",
  "abc12345",
  "1234qwer",
  "qwer1234",
  "iloveyou",
  "football"
]);

export const MAX_PASSWORD_LENGTH = 256;

export function validatePasswordStrength(password: string): string | null {
  const normalized = password.trim();

  if (normalized.length < 8) {
    return "Пароль должен быть не короче 8 символов.";
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Пароль не должен быть длиннее ${MAX_PASSWORD_LENGTH} символов.`;
  }

  if (!/[a-zа-яё]/i.test(normalized)) {
    return "Пароль должен содержать хотя бы одну букву.";
  }

  if (!/\d/.test(normalized)) {
    return "Пароль должен содержать хотя бы одну цифру.";
  }

  if (COMMON_PASSWORDS.has(normalized.toLowerCase())) {
    return "Этот пароль слишком распространён, выберите другой.";
  }

  return null;
}
