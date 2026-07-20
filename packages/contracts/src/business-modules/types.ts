import type { z } from "zod";

import type { apiMethodSchema } from "./common";

export type ApiMethod = z.infer<typeof apiMethodSchema>;
