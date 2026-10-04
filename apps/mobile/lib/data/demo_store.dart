import 'package:flutter/widgets.dart';

import '../models/vault_models.dart';

class DemoStore extends ChangeNotifier {
  UserRole role = UserRole.owner;
  String clientName = 'Rahul Sharma';
  String clientEmail = 'rahul.sharma@legacyclient.com';
  VaultStatus status = VaultStatus.active;
  DateTime lastCheckIn = DateTime.now().subtract(const Duration(hours: 2));
  int guardianThreshold = 2;
  int checkInDays = 30;
  int releaseStage = 0;
  int guardianApprovals = 0;
  String deathCertificateStatus = 'None';
  bool clientPlanConfirmed = false;
  bool recoveryPending = false;
  String recoveryReason = 'No recovery request is pending.';

  final List<VaultAsset> assets = [
    VaultAsset(
      id: 'asset-1',
      name: 'HDFC Private Banking & Demat',
      category: AssetCategory.financial,
      detail: 'Account ending 4419 · folio #IN-88912',
      recipient: 'Mehta & Partners',
      customRule: 'Legal packet for executor claim',
    ),
    VaultAsset(
      id: 'asset-2',
      name: '1Password Family Recovery Key',
      category: AssetCategory.access,
      detail: 'Encrypted browser-side · secret not shown',
      recipient: 'Asha Sharma',
      customRule: 'Stage 2 · time-locked access kit',
    ),
    VaultAsset(
      id: 'asset-3',
      name: 'Ethereum Cold Storage',
      category: AssetCategory.crypto,
      detail: 'Primary vault balance: 14.5 ETH',
      recipient: 'Asha Sharma',
      customRule: 'Custom split: Asha 70%, Arjun 30%',
    ),
    VaultAsset(
      id: 'asset-4',
      name: 'Bitcoin Cold Wallet',
      category: AssetCategory.crypto,
      detail: 'Multi-signature wallet · 1.25 BTC',
      recipient: 'All beneficiaries',
      customRule: 'Distribute equally to all beneficiaries',
    ),
    VaultAsset(
      id: 'asset-5',
      name: 'CryptoPunk #1234',
      category: AssetCategory.crypto,
      detail: 'ERC-721 digital collectible · 1 NFT',
      recipient: 'Diya Sharma',
      customRule: 'Assign 100% to Diya Sharma',
    ),
    VaultAsset(
      id: 'asset-6',
      name: 'Google & Proton Recovery Kit',
      category: AssetCategory.access,
      detail: 'Emergency cloud restore kit · secret not shown',
      recipient: 'Arjun Sharma',
      customRule: 'Stage 2 · time-locked access kit',
    ),
    VaultAsset(
      id: 'asset-7',
      name: 'Bandra Apartment Property Deed',
      category: AssetCategory.financial,
      detail: 'Registration document #2019-BDR-8812',
      recipient: 'Mehta & Partners',
      customRule: 'Stage 1 · legal packet for executor claim',
    ),
  ];
  final List<VaultPerson> guardians = [
    VaultPerson(
      id: 'g-1',
      name: 'Mehta & Partners',
      contact: 'trusts@mehtapartners.com',
      role: UserRole.guardian,
      verified: true,
    ),
    VaultPerson(
      id: 'g-2',
      name: 'Vikram Sharma',
      contact: '+91 98200 44122',
      role: UserRole.guardian,
      verified: true,
    ),
    VaultPerson(
      id: 'g-3',
      name: 'Priya Sharma',
      contact: '+91 98199 77800',
      role: UserRole.guardian,
    ),
  ];
  final List<VaultPerson> beneficiaries = [
    VaultPerson(
      id: 'b-1',
      name: 'Mehta & Partners',
      contact: 'trusts@mehtapartners.com',
      role: UserRole.executor,
    ),
    VaultPerson(
      id: 'b-2',
      name: 'Asha Sharma',
      contact: 'asha.s@gmail.com',
      role: UserRole.beneficiary,
    ),
    VaultPerson(
      id: 'b-3',
      name: 'Arjun Sharma',
      contact: 'arjun.s@gmail.com',
      role: UserRole.beneficiary,
    ),
    VaultPerson(
      id: 'b-4',
      name: 'Diya Sharma',
      contact: 'diya.s@gmail.com',
      role: UserRole.beneficiary,
    ),
  ];
  final Map<String, bool> manualChecks = {
    'nominees': false,
    'google': false,
    'apple': false,
    'emergency': true,
  };
  final List<ActivityRecord> activity = [
    ActivityRecord(
      'Client check-in recorded in this demo',
      DateTime.now().subtract(const Duration(hours: 2)),
    ),
    ActivityRecord(
      'Release policy configured: 2 of 3 guardians',
      DateTime.now().subtract(const Duration(days: 1)),
    ),
    ActivityRecord(
      'Crypto recovery needs additional setup',
      DateTime.now().subtract(const Duration(days: 2)),
      warning: true,
    ),
  ];
  final Set<String> readNotifications = {};
  final Map<String, String> guardianDecisions = {};

  int get configuredAssets => assets.where((asset) => asset.configured).length;
  int get readyChecks =>
      manualChecks.values.where((value) => value).length +
      (guardians.length >= guardianThreshold ? 1 : 0) +
      (beneficiaries.any((person) => person.role == UserRole.executor)
          ? 1
          : 0) +
      (assets.isNotEmpty ? 1 : 0);
  int get totalChecks => manualChecks.length + 3;
  bool get isInterventionAvailable =>
      status == VaultStatus.triggerPending || status == VaultStatus.vetoWindow;

  void updateClientProfile({required String name, required String email}) {
    clientName = name;
    clientEmail = email;
    activity.insert(0, ActivityRecord('Client vault prepared for $name', DateTime.now()));
    notifyListeners();
  }

  void submitDeathCertificate(String fileName) {
    deathCertificateStatus = 'Pending';
    recoveryPending = true;
    if (status == VaultStatus.active || status == VaultStatus.watch) {
      status = VaultStatus.triggerPending;
    }
    activity.insert(0, ActivityRecord('Death certificate recorded for review: $fileName', DateTime.now(), warning: true));
    notifyListeners();
  }

  void verifyDeathCertificate({required bool approved}) {
    deathCertificateStatus = approved ? 'Verified' : 'Rejected';
    if (approved && guardianApprovals >= guardianThreshold) {
      status = VaultStatus.vetoWindow;
      recoveryPending = true;
    }
    activity.insert(0, ActivityRecord('Law firm ${approved ? 'verified' : 'rejected'} the demo document', DateTime.now(), warning: !approved));
    notifyListeners();
  }

  void executeDemoWill() {
    if (deathCertificateStatus != 'Verified' || guardianApprovals < guardianThreshold) return;
    releaseStage = 1;
    status = VaultStatus.stagedRelease;
    recoveryReason = 'Digital will execution previewed locally. Stage 1 legal guidance is available; later stages remain locked.';
    activity.insert(0, ActivityRecord('Digital will execution previewed · Stage 1 opened', DateTime.now()));
    notifyListeners();
  }

  void advanceReleaseStage() {
    if (releaseStage < 1 || releaseStage >= 3) return;
    releaseStage++;
    if (releaseStage == 3) {
      status = VaultStatus.completed;
    }
    activity.insert(0, ActivityRecord('Demo release advanced to Stage $releaseStage', DateTime.now()));
    notifyListeners();
  }

  void recordDemoCheckIn() {
    lastCheckIn = DateTime.now();
    if (status == VaultStatus.watch) status = VaultStatus.active;
    activity.insert(
      0,
      ActivityRecord(
        'Demo check-in saved on this device; no server request was made',
        lastCheckIn,
      ),
    );
    notifyListeners();
  }

  void addAsset(VaultAsset asset) {
    assets.insert(0, asset);
    activity.insert(
      0,
      ActivityRecord('Demo asset added: ${asset.name}', DateTime.now()),
    );
    notifyListeners();
  }

  void updateAsset(VaultAsset asset) {
    final index = assets.indexWhere((item) => item.id == asset.id);
    if (index >= 0) assets[index] = asset;
    notifyListeners();
  }

  void confirmClientPlan() {
    clientPlanConfirmed = true;
    activity.insert(
      0,
      ActivityRecord('Client reviewed the inheritance plan locally', DateTime.now()),
    );
    notifyListeners();
  }

  void setAssetRule(String assetId, String rule) {
    final index = assets.indexWhere((asset) => asset.id == assetId);
    if (index < 0) return;
    assets[index].customRule = rule;
    activity.insert(
      0,
      ActivityRecord('Release rule updated for ${assets[index].name}', DateTime.now()),
    );
    notifyListeners();
  }

  void removeAsset(String id) {
    assets.removeWhere((asset) => asset.id == id);
    notifyListeners();
  }

  void addPerson(VaultPerson person) {
    (person.role == UserRole.guardian ? guardians : beneficiaries).add(person);
    activity.insert(
      0,
      ActivityRecord('Demo contact added: ${person.name}', DateTime.now()),
    );
    notifyListeners();
  }

  void removePerson(VaultPerson person) {
    (person.role == UserRole.guardian ? guardians : beneficiaries).removeWhere(
      (item) => item.id == person.id,
    );
    notifyListeners();
  }

  void setThreshold(int value) {
    guardianThreshold = value;
    notifyListeners();
  }

  void toggleCheck(String key) {
    manualChecks[key] = !(manualChecks[key] ?? false);
    notifyListeners();
  }

  void setCheckInDays(int value) {
    checkInDays = value;
    notifyListeners();
  }

  void startScenario(String scenario) {
    recoveryPending = true;
    guardianApprovals = scenario == 'legitimate' ? guardianThreshold : 0;
    deathCertificateStatus = scenario == 'legitimate' ? 'Verified' : 'Pending';
    if (scenario == 'legitimate') {
      status = VaultStatus.vetoWindow;
      recoveryReason = 'Demo: guardian threshold and evidence review are represented as complete. No external verification occurred.';
    } else {
      status = VaultStatus.triggerPending;
      recoveryReason = 'Demo: a recovery request is awaiting independent review. No external request was created.';
    }
    activity.insert(
      0,
      ActivityRecord(
        'Demo scenario preview: $scenario recovery',
        DateTime.now(),
        warning: true,
      ),
    );
    notifyListeners();
  }

  void cancelDemoRecovery() {
    recoveryPending = false;
    guardianApprovals = 0;
    deathCertificateStatus = 'None';
    status = VaultStatus.active;
    releaseStage = 0;
    clientPlanConfirmed = false;
    recoveryReason =
        'The local demo scenario was reset. No server operation was performed.';
    activity.insert(
      0,
      ActivityRecord('Demo recovery preview reset locally', DateTime.now()),
    );
    notifyListeners();
  }

  void setGuardianDecision(String requestId, String decision) {
    guardianDecisions[requestId] = decision;
    if (decision == 'Approve') {
      guardianApprovals = (guardianApprovals + 1).clamp(0, guardians.length).toInt();
      if (guardianApprovals >= guardianThreshold && deathCertificateStatus == 'Verified') {
        status = VaultStatus.vetoWindow;
      } else if (guardianApprovals >= guardianThreshold) {
        status = VaultStatus.triggerPending;
      }
    }
    activity.insert(
      0,
      ActivityRecord(
        'Demo guardian response saved locally: $decision',
        DateTime.now(),
        warning: decision == 'Rejected',
      ),
    );
    notifyListeners();
  }

  void markNotificationRead(String id) {
    readNotifications.add(id);
    notifyListeners();
  }

  void resetDemo() {
    status = VaultStatus.active;
    recoveryPending = false;
    releaseStage = 0;
    guardianApprovals = 0;
    deathCertificateStatus = 'None';
    clientPlanConfirmed = false;
    guardianDecisions.clear();
    readNotifications.clear();
    notifyListeners();
  }
}

class StoreScope extends InheritedNotifier<DemoStore> {
  const StoreScope({super.key, required DemoStore store, required super.child})
    : super(notifier: store);

  static DemoStore of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<StoreScope>();
    assert(scope != null, 'StoreScope is missing above this context');
    return scope!.notifier!;
  }
}
