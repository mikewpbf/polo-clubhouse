// Task #121 (step 8): super-admin API key management. The raw key is shown
// in the response of POST exactly once and never retrievable again.
import { Router, type IRouter } from "express";
import { requireSuperAdmin, requireAuth } from "../lib/auth";
import { CLIENT_KINDS, type ClientKind } from "../lib/config";
import { createApiKey, listApiKeys, revokeApiKey } from "../lib/apiKeys";

const router: IRouter = Router();

router.get("/admin/api-keys", requireAuth, requireSuperAdmin, async (_req, res) => {
  try {
    res.json(await listApiKeys());
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.post("/admin/api-keys", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { clientName, clientKind } = req.body || {};
    if (!clientName || typeof clientName !== "string") {
      res.status(400).json({ message: "clientName required" }); return;
    }
    if (!clientKind || !CLIENT_KINDS.includes(clientKind as ClientKind)) {
      res.status(400).json({ message: `clientKind must be one of: ${CLIENT_KINDS.join(", ")}` }); return;
    }
    const created = await createApiKey({ clientName, clientKind: clientKind as ClientKind, createdBy: req.user!.id });
    res.status(201).json(created);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

router.delete("/admin/api-keys/:id", requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const ok = await revokeApiKey(String(req.params.id));
    if (!ok) { res.status(404).json({ message: "API key not found" }); return; }
    res.json({ message: "API key revoked" });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

export default router;
