import { getCurrentUser } from "./session";

export async function requireApiAuthentication(): Promise<Response | null> {
  const user = await getCurrentUser();

  if (user) {
    return null;
  }

  return Response.json(
    {
      code: "UNAUTHORIZED",
      message: "Authentication required.",
    },
    { status: 401 }
  );
}
