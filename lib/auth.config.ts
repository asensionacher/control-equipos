import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const authenticatedUser = user as typeof user & {
          rol: "ADMIN" | "USUARIO";
          nombre: string;
          apellidos: string;
          twoFactorStatus?: "none" | "complete";
        };
        token.id = authenticatedUser.id;
        token.rol = authenticatedUser.rol;
        token.nombre = authenticatedUser.nombre;
        token.apellidos = authenticatedUser.apellidos;
        token.twoFactorStatus = authenticatedUser.twoFactorStatus ?? "complete";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.rol = token.rol as "ADMIN" | "USUARIO";
        session.user.nombre = token.nombre as string;
        session.user.apellidos = token.apellidos as string;
        session.user.twoFactorStatus =
          (token.twoFactorStatus as "none" | "complete" | undefined) ?? "complete";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
