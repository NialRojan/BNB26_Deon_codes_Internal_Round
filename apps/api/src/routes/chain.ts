import { Router } from "express";
import { ContractClient } from "../chain/contractClient.js";

const router = Router();
const contracts = new ContractClient();

// Public read of on-chain vault state (all data here is already public on Sepolia).
// GET /chain/vault            -> configured vault
// GET /chain/vault/:address   -> any HeirloomVault
router.get(["/vault", "/vault/:address"], async (req, res, next) => {
  try {
    const data = await contracts.getVaultState(req.params.address);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

export default router;
