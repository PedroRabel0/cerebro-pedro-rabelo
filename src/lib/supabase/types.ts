export type UserRole = "pedro" | "henrique";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
}
