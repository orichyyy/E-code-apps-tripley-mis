import type { AuthContextVariables } from "./core/auth-context/auth-context";
import type { RequestIdVariables } from "./middleware/request-id";

export type AppBindings = {
  Variables: RequestIdVariables & AuthContextVariables;
};
