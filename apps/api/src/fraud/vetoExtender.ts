import { RiskLevel } from "@heirloom/shared";
import { logger } from "../config/logger.js";

export class VetoExtender {
  /**
   * Computes the required extension for the VetoTimer countdown based on the assessed risk level.
   * Feeds Member 2's contracts/VetoTimer.sol on-chain timer extension.
   */
  static calculateExtensionDays(level: RiskLevel, baseWindowDays = 14): {
    extensionDays: number;
    totalVetoDays: number;
    shouldHaltAutomaticRelease: boolean;
  } {
    let extensionDays = 0;
    let shouldHaltAutomaticRelease = false;

    switch (level) {
      case "CRITICAL":
        extensionDays = 14;
        shouldHaltAutomaticRelease = true;
        break;
      case "HIGH":
        extensionDays = 14;
        shouldHaltAutomaticRelease = false;
        break;
      case "MEDIUM":
        extensionDays = 7;
        shouldHaltAutomaticRelease = false;
        break;
      case "LOW":
      default:
        extensionDays = 0;
        shouldHaltAutomaticRelease = false;
        break;
    }

    const totalVetoDays = baseWindowDays + extensionDays;

    logger.info(`[VetoExtender] Evaluated extension for risk level '${level}': +${extensionDays} days (Total: ${totalVetoDays}d)`);

    return {
      extensionDays,
      totalVetoDays,
      shouldHaltAutomaticRelease,
    };
  }
}
