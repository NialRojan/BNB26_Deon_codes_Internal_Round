enum UserRole { owner, guardian, beneficiary, executor }

enum VaultStatus {
  active,
  watch,
  triggerPending,
  vetoWindow,
  stagedRelease,
  completed,
}

enum AssetCategory { crypto, access, financial }

extension UserRoleLabel on UserRole {
  String get label => switch (this) {
    UserRole.owner => 'Owner',
    UserRole.guardian => 'Guardian',
    UserRole.beneficiary => 'Beneficiary',
    UserRole.executor => 'Executor',
  };
}

extension VaultStatusLabel on VaultStatus {
  String get label => switch (this) {
    VaultStatus.active => 'Active',
    VaultStatus.watch => 'Watch',
    VaultStatus.triggerPending => 'Trigger pending',
    VaultStatus.vetoWindow => 'Veto window',
    VaultStatus.stagedRelease => 'Staged release',
    VaultStatus.completed => 'Completed',
  };
}

extension AssetCategoryLabel on AssetCategory {
  String get label => switch (this) {
    AssetCategory.crypto => 'Crypto wallet',
    AssetCategory.access => 'Passwords & 2FA',
    AssetCategory.financial => 'Financial account',
  };
}

class VaultAsset {
  VaultAsset({
    required this.id,
    required this.name,
    required this.category,
    required this.detail,
    required this.recipient,
    this.configured = true,
  });
  final String id;
  String name;
  final AssetCategory category;
  String detail;
  String recipient;
  bool configured;
}

class VaultPerson {
  VaultPerson({
    required this.id,
    required this.name,
    required this.contact,
    required this.role,
    this.verified = false,
  });
  final String id;
  String name;
  String contact;
  final UserRole role;
  bool verified;
}

class ActivityRecord {
  ActivityRecord(this.title, this.at, {this.warning = false});
  final String title;
  final DateTime at;
  final bool warning;
}
