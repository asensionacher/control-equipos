import type { NextAuthConfig } from "next-auth";
import { obtenerRedirectAuthSeguro } from "./safe-redirect";

export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    async redirect({ url, baseUrl }) {
      return obtenerRedirectAuthSeguro(url, baseUrl);
    },
    async jwt({ token, user }) {
      if (user) {
        const authenticatedUser = user as typeof user & {
          rol: "ADMIN" | "USUARIO";
          nombre: string;
          apellidos: string;
          authVersion: number;
          twoFactorStatus: "none" | "setup_required" | "complete";
          mfaVerifiedAt?: number;
        };
        token.id = authenticatedUser.id;
        token.rol = authenticatedUser.rol;
        token.nombre = authenticatedUser.nombre;
        token.apellidos = authenticatedUser.apellidos;
        token.authVersion = authenticatedUser.authVersion;
        token.twoFactorStatus = authenticatedUser.twoFactorStatus;
        token.mfaVerifiedAt = authenticatedUser.mfaVerifiedAt;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.rol = token.rol as "ADMIN" | "USUARIO";
        session.user.nombre = token.nombre as string;
        session.user.apellidos = token.apellidos as string;
        session.user.authVersion = token.authVersion as number;
        session.user.twoFactorStatus =
          token.twoFactorStatus as "none" | "setup_required" | "complete";
        session.user.mfaVerifiedAt = token.mfaVerifiedAt as number | undefined;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
