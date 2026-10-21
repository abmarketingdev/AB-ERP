import { z } from "zod";

/**
 * GET /api/recruitment/access/me/ — what this user may see (SRS §2.2).
 *
 * The server is the authority: every endpoint re-checks the same keys. The ERP only
 * uses this to decide what to show. Keys are `<modul>.<handling>`, e.g.
 * `candidates.read`, `approval.approve`.
 */
export const accessMeSchema = z.object({
  userId: z.string(),
  username: z.string(),
  template: z.string().nullable(),
  templateLabel: z.string().nullable(),
  permissions: z.array(z.string()),
  modules: z.array(z.string()),
  /** Permissions that also need a token proving 2FA (IFK-04). */
  stepUp: z.array(z.string()),
  /** True when this token proves an OTP was entered (amr contains "otp"). */
  mfa: z.boolean(),
  /** False only on test environments where the 2FA requirement is switched off. */
  stepUpEnforced: z.boolean().default(true),
  isSuperuser: z.boolean(),
  /** Set when the user holds no modules at all: who to ask (Norwegian, from the server). */
  message: z.string().nullable().optional(),
});
export type AccessMe = z.infer<typeof accessMeSchema>;
