import 'package:flutter/widgets.dart';

import '../models/vault_models.dart';
import 'vault_repository.dart';

class DemoStore extends ChangeNotifier {
<<<<<<< Updated upstream
  UserRole role = UserRole.owner;
=======
  UserRole role = UserRole.client;
  String clientName = 'Rahul Sharma';
  String clientEmail = 'rahul.sharma@legacyclient.com';
>>>>>>> Stashed changes
  VaultStatus status = VaultStatus.active;
  DateTime lastCheckIn = DateTime.now().subtract(const Duration(hours: 2));
  int guardianThreshold = 3;
  int checkInDays = 7;
  int releaseStage = 0;
  bool recoveryPending = false;
  String recoveryReason = 'No recovery request is pending.';

  final List<VaultAsset> assets = [
    VaultAsset(
      id: 'asset-1',
      name: 'HDFC savings account',
      category: AssetCategory.financial,
      detail: 'Savings · ending 4417 · nominee recorded',
      recipient: 'Sana Khan',
    ),
    VaultAsset(
      id: 'asset-2',
      name: 'Password manager',
      category: AssetCategory.access,
      detail: 'Recovery method configured · secret not shown',
      recipient: 'Arjun Khan',
    ),
    VaultAsset(
      id: 'asset-3',
      name: 'Hardware wallet',
      category: AssetCategory.crypto,
      detail: 'Ethereum · recovery setup incomplete',
      recipient: 'Vikram Rao',
      configured: false,
    ),
  ];
  final List<VaultPerson> guardians = [
    VaultPerson(
      id: 'g-1',
      name: 'Meera Shah',
      contact: 'meera@example.com',
      role: UserRole.guardian,
      verified: true,
    ),
    VaultPerson(
      id: 'g-2',
      name: 'Rohan Iyer',
      contact: '+91 98200 11111',
      role: UserRole.guardian,
      verified: true,
    ),
    VaultPerson(
      id: 'g-3',
      name: 'Kavya Nair',
      contact: 'kavya@example.com',
      role: UserRole.guardian,
    ),
    VaultPerson(
      id: 'g-4',
      name: 'Dev Patel',
      contact: '+91 98200 22222',
      role: UserRole.guardian,
    ),
    VaultPerson(
      id: 'g-5',
      name: 'Anika Rao',
      contact: 'anika@example.com',
      role: UserRole.guardian,
    ),
  ];
  final List<VaultPerson> beneficiaries = [
    VaultPerson(
      id: 'b-1',
<<<<<<< Updated upstream
      name: 'Sana Khan',
      contact: 'sana@example.com',
      role: UserRole.executor,
    ),
    VaultPerson(
      id: 'b-2',
      name: 'Arjun Khan',
      contact: 'arjun@example.com',
      role: UserRole.beneficiary,
    ),
    VaultPerson(
      id: 'b-3',
      name: 'Vikram Rao',
      contact: 'vikram@example.com',
      role: UserRole.beneficiary,
=======
      name: 'Mehta & Partners',
      contact: 'trusts@mehtapartners.com',
      role: UserRole.heir,
      isExecutor: true,
    ),
    VaultPerson(
      id: 'b-2',
      name: 'Asha Sharma',
      contact: 'asha.s@gmail.com',
      role: UserRole.heir,
    ),
    VaultPerson(
      id: 'b-3',
      name: 'Arjun Sharma',
      contact: 'arjun.s@gmail.com',
      role: UserRole.heir,
    ),
    VaultPerson(
      id: 'b-4',
      name: 'Diya Sharma',
      contact: 'diya.s@gmail.com',
      role: UserRole.heir,
>>>>>>> Stashed changes
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
      'Owner check-in recorded in this demo',
      DateTime.now().subtract(const Duration(hours: 2)),
    ),
    ActivityRecord(
      'Release policy configured: 3 of 5 guardians',
      DateTime.now().subtract(const Duration(days: 1)),
    ),
    ActivityRecord(
      'Hardware wallet needs recovery setup',
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
      (beneficiaries.any((person) => person.isExecutor) ? 1 : 0) +
      (assets.isNotEmpty ? 1 : 0);
  int get totalChecks => manualChecks.length + 3;
  bool get isInterventionAvailable =>
      status == VaultStatus.triggerPending || status == VaultStatus.vetoWindow;

<<<<<<< Updated upstream
=======
  void updateClientProfile({required String name, required String email}) {
    clientName = name;
    clientEmail = email;
    activity.insert(
      0,
      ActivityRecord('Client vault prepared for $name', DateTime.now()),
    );
    notifyListeners();
  }

  void submitDeathCertificate(String fileName) {
    deathCertificateStatus = 'Pending';
    recoveryPending = true;
    if (status == VaultStatus.active || status == VaultStatus.watch) {
      status = VaultStatus.triggerPending;
    }
    activity.insert(
      0,
      ActivityRecord(
        'Death certificate recorded for review: $fileName',
        DateTime.now(),
        warning: true,
      ),
    );
    notifyListeners();
  }

  void verifyDeathCertificate({required bool approved}) {
    deathCertificateStatus = approved ? 'Verified' : 'Rejected';
    if (approved && guardianApprovals >= guardianThreshold) {
      status = VaultStatus.vetoWindow;
      recoveryPending = true;
    }
    activity.insert(
      0,
      ActivityRecord(
        'Law firm ${approved ? 'verified' : 'rejected'} the demo document',
        DateTime.now(),
        warning: !approved,
      ),
    );
    notifyListeners();
  }

  void executeDemoWill() {
    if (deathCertificateStatus != 'Verified' ||
        guardianApprovals < guardianThreshold)
      return;
    releaseStage = 1;
    status = VaultStatus.stagedRelease;
    recoveryReason = 'Digital will execution previewed locally. Stage 1 legal guidance is available; later stages remain locked.';
    activity.insert(
      0,
      ActivityRecord(
        'Digital will execution previewed · Stage 1 opened',
        DateTime.now(),
      ),
    );
    notifyListeners();
  }

  void advanceReleaseStage() {
    if (releaseStage < 1 || releaseStage >= 3) return;
    releaseStage++;
    if (releaseStage == 3) {
      status = VaultStatus.completed;
    }
    activity.insert(
      0,
      ActivityRecord(
        'Demo release advanced to Stage $releaseStage',
        DateTime.now(),
      ),
    );
    notifyListeners();
  }

>>>>>>> Stashed changes
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

<<<<<<< Updated upstream
=======
  void confirmClientPlan() {
    clientPlanConfirmed = true;
    activity.insert(
      0,
      ActivityRecord(
        'Client reviewed the inheritance plan locally',
        DateTime.now(),
      ),
    );
    notifyListeners();
  }

  void setAssetRule(String assetId, String rule) {
    final index = assets.indexWhere((asset) => asset.id == assetId);
    if (index < 0) return;
    assets[index].customRule = rule;
    activity.insert(
      0,
      ActivityRecord(
        'Release rule updated for ${assets[index].name}',
        DateTime.now(),
      ),
    );
    notifyListeners();
  }

>>>>>>> Stashed changes
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
    status = VaultStatus.active;
    releaseStage = 0;
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
<<<<<<< Updated upstream
=======
    if (decision == 'Approve') {
      guardianApprovals = (guardianApprovals + 1)
          .clamp(0, guardians.length)
          .toInt();
      if (guardianApprovals >= guardianThreshold &&
          deathCertificateStatus == 'Verified') {
        status = VaultStatus.vetoWindow;
      } else if (guardianApprovals >= guardianThreshold) {
        status = VaultStatus.triggerPending;
      }
    }
>>>>>>> Stashed changes
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
    guardianDecisions.clear();
    readNotifications.clear();
    notifyListeners();
  }
}

class DemoVaultRepository extends ChangeNotifier implements VaultRepository {
  DemoVaultRepository(this.store) {
    store.addListener(notifyListeners);
  }

  final DemoStore store;

  @override
  bool get isDemo => true;

  @override
  Future<List<VaultSummary>> discoverVaults(String walletAddress) async =>
      const [];

  @override
  Future<VaultSnapshot> readVault(String vaultAddress) async => VaultSnapshot(
    address: vaultAddress,
    state: store.status,
    lastHeartbeat: store.lastCheckIn,
    inactivityThresholdSeconds: store.checkInDays * Duration.secondsPerDay,
    vetoEndTime: null,
    ethBalanceWei: BigInt.zero,
    owner: 'demo-client',
    executor:
        store.beneficiaries
            .where((person) => person.isExecutor)
            .firstOrNull
            ?.id ??
        '',
    guardians: store.guardians.map((person) => person.id).toList(),
    requiredSignatures: store.guardianThreshold,
    currentSignatures: store.guardianApprovals,
    defaultAllocations: const [],
    isExecuted: store.releaseStage > 0,
  );

  @override
  Future<String> pingHeartbeat(String vaultAddress) async {
    store.recordDemoCheckIn();
    return 'demo-local';
  }

  @override
  Future<String> vetoRecovery(String vaultAddress) async {
    store.cancelDemoRecovery();
    return 'demo-local';
  }

  @override
  Future<String> attestGuardian(String vaultAddress) async {
    store.setGuardianDecision('demo-request-1', 'Approve');
    return 'demo-local';
  }

  @override
  Future<String> depositEth(String vaultAddress, BigInt wei) async =>
      'demo-local';

  @override
  Future<BigInt> claimEth(String vaultAddress, String heirAddress) async =>
      BigInt.zero;

  @override
  void dispose() {
    store.removeListener(notifyListeners);
    super.dispose();
  }
}

class StoreScope extends InheritedNotifier<VaultRepository> {
  factory StoreScope({
    Key? key,
    required DemoStore store,
    required Widget child,
    VaultRepository? repository,
  }) {
    final selected = repository ?? DemoVaultRepository(store);
    return StoreScope._(
      key: key,
      demoStore: store,
      repository: selected,
      child: child,
    );
  }

  StoreScope._({
    super.key,
    required this.demoStore,
    required this.repository,
    required super.child,
  }) : super(notifier: repository);

  final DemoStore demoStore;
  final VaultRepository repository;

  static DemoStore of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<StoreScope>();
    assert(scope != null, 'StoreScope is missing above this context');
    return scope!.demoStore;
  }

  static VaultRepository repositoryOf(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<StoreScope>();
    assert(scope != null, 'StoreScope is missing above this context');
    return scope!.repository;
  }
}
