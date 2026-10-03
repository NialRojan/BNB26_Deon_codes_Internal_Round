import 'package:flutter/widgets.dart';

import '../models/vault_models.dart';

class DemoStore extends ChangeNotifier {
  UserRole role = UserRole.owner;
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
      (beneficiaries.any((person) => person.role == UserRole.executor)
          ? 1
          : 0) +
      (assets.isNotEmpty ? 1 : 0);
  int get totalChecks => manualChecks.length + 3;
  bool get isInterventionAvailable =>
      status == VaultStatus.triggerPending || status == VaultStatus.vetoWindow;

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

class StoreScope extends InheritedNotifier<DemoStore> {
  const StoreScope({super.key, required DemoStore store, required super.child})
    : super(notifier: store);

  static DemoStore of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<StoreScope>();
    assert(scope != null, 'StoreScope is missing above this context');
    return scope!.notifier!;
  }
}
