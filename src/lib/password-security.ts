// Common passwords that should be rejected (top 100 most common)
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '123456', '12345678', '123456789',
  '1234567890', 'qwerty', 'abc123', 'monkey', 'letmein', 'dragon', 'master',
  'baseball', 'iloveyou', 'trustno1', 'sunshine', 'princess', 'welcome',
  'admin', 'admin123', 'login', 'passw0rd', '1234', '12345', 'football',
  'shadow', '123123', '654321', 'superman', 'qazwsx', 'michael', 'ashley',
  'bailey', 'mustang', 'access', 'jesus', 'batman', 'starwars', 'hello',
  'charlie', 'donald', 'password1!', '1q2w3e4r', 'qwerty123', 'zaq1zaq1',
  'test123', 'pass123', 'hockey', 'ranger', 'buster', 'thomas', 'robert',
  'soccer', 'harley', 'daniel', 'jennifer', 'jordan', 'andrew', 'lakers',
  'andrea', 'joshua', 'george', 'thunder', 'summer', 'winter', 'spring',
  'autumn', 'matrix', 'mercedes', 'pepper', 'cheese', 'cookie', 'ninja',
  'killer', 'secret', 'whatever', 'freedom', 'computer', 'internet',
  'asshole', 'fuckyou', 'f*ck', 'shit', 'biteme', 'yankees', 'cowboys',
  'eagles', 'steelers', 'rangers', 'tigers', 'boston', 'newyork', 'florida',
  'london', 'paris', 'chicago', 'phoenix', 'austin', 'denver', 'dallas',
  'houston', 'memphis', 'oakland', 'seattle', 'qwer1234', 'asdf1234',
  'zxcv1234', '1qaz2wsx', 'q1w2e3r4', 'pass1234', 'test1234', 'user1234'
]);

// Patterns that indicate weak passwords
const WEAK_PATTERNS = [
  /^(.)\1{5,}$/,           // Repeated characters (aaaaaa)
  /^(012|123|234|345|456|567|678|789)+$/,  // Sequential numbers
  /^(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)+$/i, // Sequential letters
  /^(qwerty|asdf|zxcv|qwer|asdf|zxcv)/i,  // Keyboard patterns
  /^(19|20)\d{2}$/,        // Years alone (1990, 2023)
];

export interface PasswordSecurityResult {
  isCompromised: boolean;
  reason?: string;
}

/**
 * Check if a password is commonly used or follows weak patterns
 * This is a client-side check against known weak passwords
 */
export const checkPasswordSecurity = (password: string): PasswordSecurityResult => {
  const normalizedPassword = password.toLowerCase().trim();
  
  // Check against common passwords list
  if (COMMON_PASSWORDS.has(normalizedPassword)) {
    return {
      isCompromised: true,
      reason: 'This password is too common and easily guessable'
    };
  }
  
  // Check for common password with numbers appended (password1, password123, etc.)
  const basePassword = normalizedPassword.replace(/\d+$/, '');
  if (COMMON_PASSWORDS.has(basePassword) && normalizedPassword !== basePassword) {
    return {
      isCompromised: true,
      reason: 'Adding numbers to a common password is not secure'
    };
  }
  
  // Check for weak patterns
  for (const pattern of WEAK_PATTERNS) {
    if (pattern.test(normalizedPassword)) {
      return {
        isCompromised: true,
        reason: 'This password follows a predictable pattern'
      };
    }
  }
  
  // Check if password contains common words with simple substitutions
  const desubstituted = normalizedPassword
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's');
  
  if (COMMON_PASSWORDS.has(desubstituted)) {
    return {
      isCompromised: true,
      reason: 'Simple character substitutions do not make common passwords secure'
    };
  }
  
  return { isCompromised: false };
};

/**
 * Calculate password entropy (bits of randomness)
 * Higher is better - 50+ bits is considered strong
 */
export const calculatePasswordEntropy = (password: string): number => {
  let charsetSize = 0;
  
  if (/[a-z]/.test(password)) charsetSize += 26;
  if (/[A-Z]/.test(password)) charsetSize += 26;
  if (/[0-9]/.test(password)) charsetSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 32;
  
  if (charsetSize === 0) return 0;
  
  return Math.floor(password.length * Math.log2(charsetSize));
};
