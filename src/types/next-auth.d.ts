import { type DefaultSession } from "next-auth";

export type ExtendedUser = DefaultSession["user"] & {
  id: string;
  role: string;
};

declare module "next-auth" {
  interface Session {
    user: ExtendedUser;
  }
}
