import { z } from "zod";

export const loginFormSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;
