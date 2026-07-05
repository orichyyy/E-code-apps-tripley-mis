export type PasswordPolicy = {
  minLength: number;
  requireLetters: boolean;
  requireNumbers: boolean;
  periodicChangeDays: number;
};

export const defaultPasswordPolicy: PasswordPolicy = {
  minLength: 8,
  requireLetters: true,
  requireNumbers: true,
  periodicChangeDays: 365,
};

export type PasswordValidationResult = {
  valid: boolean;
  reasons: string[];
};

export function validatePasswordComplexity(
  password: string,
  policy: PasswordPolicy = defaultPasswordPolicy,
): PasswordValidationResult {
  const reasons: string[] = [];

  if (password.length < policy.minLength) {
    reasons.push("PASSWORD_MIN_LENGTH");
  }

  if (policy.requireLetters && !/[A-Za-z]/.test(password)) {
    reasons.push("PASSWORD_REQUIRES_LETTER");
  }

  if (policy.requireNumbers && !/\d/.test(password)) {
    reasons.push("PASSWORD_REQUIRES_NUMBER");
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}
