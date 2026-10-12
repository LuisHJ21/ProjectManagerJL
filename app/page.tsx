import { getAuthenticatedUser } from "../lib/team-auth";
import Dashboard from "./workspace";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getAuthenticatedUser();
  if (!user) return <LoginForm />;
  return <Dashboard />;
}
