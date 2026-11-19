// Llave del dispositivo para firmar peticiones (ECDSA P-256, WebCrypto).
// La llave privada se crea como NO exportable y se guarda en IndexedDB: el código de la página
// puede usarla para firmar, pero nadie puede leerla ni copiarla.

const DB_NAME = 'spartacus-keys'
const STORE = 'keys'
const KEY_ID = 'device'

export interface PublicJwk {
  kty: 'EC'
  crv: 'P-256'
  x: string
  y: string
}

function idb<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1)
    open.onupgradeneeded = () => open.result.createObjectStore(STORE)
    open.onerror = () => reject(open.error)
    open.onsuccess = () => {
      const tx = open.result.transaction(STORE, mode)
      const req = run(tx.objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
      tx.oncomplete = () => open.result.close()
    }
  })
}

let memoryKeys: CryptoKeyPair | null = null

async function generate(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify'])
}

/** La llave de este dispositivo; la crea la primera vez. */
export async function deviceKeys(): Promise<CryptoKeyPair> {
  if (memoryKeys) return memoryKeys
  try {
    const stored = await idb<CryptoKeyPair | undefined>('readonly', (s) => s.get(KEY_ID))
    if (stored?.privateKey) return (memoryKeys = stored)
    const created = await generate()
    await idb('readwrite', (s) => s.put(created, KEY_ID))
    return (memoryKeys = created)
  } catch {
    // Sin IndexedDB (p. ej. modo privado estricto): llave solo en memoria para esta pestaña.
    return (memoryKeys = await generate())
  }
}

/** Nueva llave para el siguiente inicio de sesión (al cerrar sesión, la anterior deja de servir). */
export async function rotateDeviceKeys(): Promise<void> {
  memoryKeys = null
  try {
    await idb('readwrite', (s) => s.delete(KEY_ID))
  } catch {
    /* sin IndexedDB no hay nada que borrar */
  }
}

export async function publicJwk(): Promise<PublicJwk> {
  const { publicKey } = await deviceKeys()
  const { kty, crv, x, y } = (await crypto.subtle.exportKey('jwk', publicKey)) as JsonWebKey
  return { kty: kty as 'EC', crv: crv as 'P-256', x: x!, y: y! }
}

const b64url = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const sha256 = async (text: string) => b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))

/**
 * Cabeceras de firma para una petición. Debe coincidir con canonicalString() del backend:
 *   METHOD \n /ruta?query \n timestamp \n nonce \n base64url(SHA-256(body))
 */
export async function signatureHeaders(method: string, pathAndQuery: string, body: string): Promise<Record<string, string>> {
  const { privateKey } = await deviceKeys()
  const timestamp = String(Date.now())
  const nonce = crypto.randomUUID()
  const canonical = [method.toUpperCase(), pathAndQuery, timestamp, nonce, await sha256(body)].join('\n')
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(canonical),
  )
  return {
    'X-Signature-Timestamp': timestamp,
    'X-Signature-Nonce': nonce,
    'X-Signature': b64url(signature),
  }
}
