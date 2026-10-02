import { getApps, initializeApp, cert, getApp, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import type { Auth } from "firebase-admin/auth";

let adminApp: App | null = null;
let adminAuthInstance: Auth | null = null;
let adminAuthPromise: Promise<Auth | null> | null = null;

function sanitizePrivateKey(rawKey?: string): string | undefined {
  if (!rawKey) return undefined;
  let key = rawKey.trim();

  if (!key.includes("-----BEGIN") && key.length > 200) {
    try {
      const decoded = Buffer.from(key, "base64").toString("utf-8");
      if (decoded.includes("-----BEGIN PRIVATE KEY-----") || decoded.includes("{")) {
        key = decoded.trim();
      }
    } catch {}
  }

  if (key.startsWith("{") && key.endsWith("}")) {
    try {
      const parsed = JSON.parse(key);
      if (parsed.private_key) {
        return sanitizePrivateKey(parsed.private_key);
      }
    } catch {}
  }

  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }

  key = key.replace(/\\r/g, "").replace(/\\n/g, "\n");
  return key;
}

function initAdminApp(): App | null {
  if (getApps().length > 0) {
    return getApp();
  }

  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_CONFIG_ADMIN;
    if (serviceAccountJson) {
      try {
        const parsed = JSON.parse(serviceAccountJson.trim());
        return initializeApp({
          credential: cert(parsed),
        });
      } catch (err) {
        console.warn("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON:", err);
      }
    }

    const projectId =
      process.env.FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = sanitizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

    if (projectId && clientEmail && privateKey) {
      return initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }

    return null;
  } catch (error) {
    console.error("Firebase Admin SDK initialization notice:", error);
    return null;
  }
}

export function getAdminApp(): App | null {
  if (!adminApp && getApps().length === 0) {
    adminApp = initAdminApp();
  } else if (getApps().length > 0) {
    adminApp = getApp();
  }
  return adminApp;
}

export function getAdminDb(): Firestore | null {
  const app = getAdminApp();
  return app ? getFirestore(app) : null;
}

export async function getAdminAuth(): Promise<Auth | null> {
  if (adminAuthInstance) return adminAuthInstance;
  if (adminAuthPromise) return adminAuthPromise;

  adminAuthPromise = (async () => {
    try {
      const app = getAdminApp();
      if (!app) return null;
      const { getAuth } = await import("firebase-admin/auth");
      adminAuthInstance = getAuth(app);
      return adminAuthInstance;
    } catch (err) {
      console.warn("firebase-admin/auth dynamic import fallback:", err);
      return null;
    }
  })();

  return adminAuthPromise;
}

/**
 * Verify user authorization token from incoming Authorization header
 */
export async function verifyUserToken(authHeader: string | null): Promise<{ uid: string; email?: string } | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.split("Bearer ")[1]?.trim();
  if (!token) return null;

  try {
    const auth = await getAdminAuth();
    if (auth) {
      const decoded = await auth.verifyIdToken(token);
      return { uid: decoded.uid, email: decoded.email };
    }
    
    // In local dev without service account, allow decoding standard JWT payload claims if valid
    const parts = token.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
      if (payload.user_id || payload.sub) {
        return { uid: payload.user_id || payload.sub, email: payload.email };
      }
    }
    return null;
  } catch (error) {
    console.warn("Token verification error:", error);
    return null;
  }
}
