import 'package:flutter/foundation.dart';

import '../models/vault_models.dart';

class VaultSummary {
  const VaultSummary({
    required this.address,
    required this.name,
    required this.roles,
  });
  final String address;
  final String name;
  final Set<UserRole> roles;
}

class VaultSnapshot {
  const VaultSnapshot({
    required this.address,
    required this.state,
    required this.lastHeartbeat,
    required this.inactivityThresholdSeconds,
    required this.vetoEndTime,
    required this.ethBalanceWei,
    required this.owner,
    required this.executor,
    required this.guardians,
    required this.requiredSignatures,
    required this.currentSignatures,
    required this.defaultAllocations,
    required this.isExecuted,
  });
  final String address;
  final VaultStatus state;
  final DateTime lastHeartbeat;
  final int inactivityThresholdSeconds;
  final DateTime? vetoEndTime;
  final BigInt ethBalanceWei;
  final String owner;
  final String executor;
  final List<String> guardians;
  final int requiredSignatures;
  final int currentSignatures;
  final List<VaultAllocation> defaultAllocations;
  final bool isExecuted;
}

class VaultAllocation {
  const VaultAllocation({
    required this.heir,
    required this.basisPoints,
    required this.unlockTime,
    required this.installments,
    required this.intervalSeconds,
  });
  final String heir;
  final int basisPoints;
  final DateTime? unlockTime;
  final int installments;
  final int intervalSeconds;
}

abstract interface class VaultRepository implements Listenable {
  bool get isDemo;
  Future<List<VaultSummary>> discoverVaults(String walletAddress);
  Future<VaultSnapshot> readVault(String vaultAddress);
  Future<String> pingHeartbeat(String vaultAddress);
  Future<String> vetoRecovery(String vaultAddress);
  Future<String> attestGuardian(String vaultAddress);
  Future<String> depositEth(String vaultAddress, BigInt wei);
  Future<BigInt> claimEth(String vaultAddress, String heirAddress);
}
