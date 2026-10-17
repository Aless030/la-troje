// Guarda las contraseñas de forma segura: nunca se guarda la contraseña, solo una
// "huella" (hash) con una sal propia de cada usuario (PBKDF2-SHA256).
const enc = new TextEncoder();
const aHex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

export function nuevaSal() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return aHex(a);
}

export async function hashClave(clave, sal) {
  if (!globalThis.crypto?.subtle) throw new Error("SIN_CRYPTO");
  const base = await crypto.subtle.importKey("raw", enc.encode(clave), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: enc.encode(sal), iterations: 100000 },
    base,
    256
  );
  return aHex(bits);
}