const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', '87654321', '11111111', '00000000',
  'password', 'password1', 'passw0rd', 'qwertyui', 'qwerty123', 'abcd1234',
  '1qaz2wsx', 'iloveyou', 'a1234567', 'aa123456', 'iii12345', 'iii@1234',
  'solution', 'solution1', 'sf123456', 'admin123', 'welcome1', 'taiwan123',
]);

export function passwordPolicyError(current, next, email) {
  if (typeof next !== 'string' || [...next].length < 8) return '新密碼至少需要 8 個字元';
  if (Buffer.byteLength(next, 'utf8') > 72) return '新密碼的 UTF-8 長度不得超過 72 bytes';
  if (next === current) return '新密碼不得與目前密碼相同';
  const account = String(email).split('@')[0].toLowerCase();
  if ([...account].length >= 3 && next.toLowerCase().includes(account)) return '新密碼不得包含 email 帳號名稱';
  if (COMMON_PASSWORDS.has(next.toLowerCase())) return '請勿使用常見密碼';
  return null;
}
