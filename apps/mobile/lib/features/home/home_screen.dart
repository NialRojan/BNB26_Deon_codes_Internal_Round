import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';
import '../../data/demo_store.dart';
import '../../models/vault_models.dart';
import '../../shared/widgets.dart';

class OwnerHomeScreen extends StatelessWidget {
  const OwnerHomeScreen({super.key, required this.onSelectTab});
  final ValueChanged<int> onSelectTab;

  Future<void> _checkIn(BuildContext context, DemoStore store) async {
    final confirmed = await confirmAction(
      context,
      title: 'Record a demo check-in?',
      message: 'This updates the demo timestamp on this device only. It does not verify your identity or contact a server.',
      confirmLabel: 'Record locally',
    );
    if (!context.mounted || !confirmed) return;
    store.recordDemoCheckIn();
    showDemoMessage(
      context,
      'Demo check-in saved locally. No server request was made.',
    );
  }

  @override
  Widget build(BuildContext context) {
    final store = StoreScope.of(context);
    final nextCheckIn = store.lastCheckIn.add(
      Duration(days: store.checkInDays),
    );
    final attention = store.totalChecks - store.readyChecks;
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 14, 18, 26),
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Good evening, Owner',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Your legacy plan at a glance',
                      style: TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: () => onSelectTab(3),
                tooltip: 'Notifications and more',
                icon: const Icon(Icons.notifications_none_rounded),
              ),
              const PersonAvatar(name: 'Owner'),
            ],
          ),
          const SizedBox(height: 14),
          const DemoBanner(),
          const SizedBox(height: 16),
          _VaultStatusCard(
            status: store.status,
            lastCheckIn: store.lastCheckIn,
            nextCheckIn: nextCheckIn,
            onCheckIn: () => _checkIn(context, store),
          ),
<<<<<<< Updated upstream
=======
          if (store.isInterventionAvailable) ...[
            const SizedBox(height: 10),
            SurfaceCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const StatusBadge(
                    label: 'Recovery in progress',
                    tone: BadgeTone.warning,
                  ),
                  const SizedBox(height: 7),
                  Text(
                    store.recoveryReason,
                    style: const TextStyle(fontSize: 11),
                  ),
                  const SizedBox(height: 9),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.tonal(
                      onPressed: () async {
                        final confirmed = await confirmAction(
                          context,
                          title: 'Cancel recovery?',
                          message: 'This resets the local preview to Active. It does not cancel a real recovery request.',
                          confirmLabel: 'Cancel recovery',
                          destructive: true,
                        );
                        if (confirmed && context.mounted) {
                          store.cancelDemoRecovery();
                          showDemoMessage(
                            context,
                            'Local recovery preview cancelled.',
                          );
                        }
                      },
                      child: const Text('I’m safe · cancel recovery'),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 10),
          OutlinedButton.icon(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) =>
                    ClientPlanReviewScreen(onContinue: () => onSelectTab(1)),
              ),
            ),
            icon: Icon(
              store.clientPlanConfirmed
                  ? Icons.fact_check
                  : Icons.rate_review_outlined,
            ),
            label: Text(
              store.clientPlanConfirmed
                  ? 'Review inheritance plan'
                  : 'Review and confirm your plan',
            ),
          ),
>>>>>>> Stashed changes
          const SizedBox(height: 20),
          const SectionTitle('Your overview'),
          const SizedBox(height: 10),
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 1.55,
            children: [
              MetricTile(
                icon: Icons.account_balance_wallet_outlined,
                value: '${store.assets.length}',
                label: 'Assets in demo vault',
              ),
              MetricTile(
                icon: Icons.people_outline,
                value: '${store.guardians.length}/${store.guardianThreshold}',
                label: 'Guardian threshold',
              ),
              MetricTile(
                icon: Icons.fact_check_outlined,
                value: '$attention',
                label: 'Items need attention',
                tone: attention > 0 ? AppColors.warning : AppColors.success,
              ),
              MetricTile(
                icon: Icons.schedule_rounded,
                value: '${store.checkInDays} days',
                label: 'Check-in interval',
              ),
            ],
          ),
          const SizedBox(height: 21),
          Row(
            children: [
              const Expanded(child: SectionTitle('Recovery stages')),
              TextButton(
                onPressed: () => onSelectTab(3),
                child: const Text('Details'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const _StagePreview(
            number: '01',
            title: 'Legal claim packet',
            recipient: 'Executor · instructions only',
          ),
          const SizedBox(height: 8),
          const _StagePreview(
            number: '02',
            title: 'Scoped access kit',
            recipient: 'Authorized beneficiaries',
          ),
          const SizedBox(height: 8),
          const _StagePreview(
            number: '03',
            title: 'Crypto recovery',
            recipient: 'Further checks and final delay',
          ),
          const SizedBox(height: 8),
          const Text(
            'All stages are locked in this local demo. No release has been authorized.',
            style: TextStyle(color: AppColors.muted, fontSize: 10),
          ),
          const SizedBox(height: 22),
          Row(
            children: [
              const Expanded(child: SectionTitle('Recent activity')),
              TextButton(
                onPressed: () => onSelectTab(3),
                child: const Text('View all'),
              ),
            ],
          ),
          const SizedBox(height: 6),
          SurfaceCard(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Column(
              children: [
                for (final event in store.activity.take(3))
                  _ActivityRow(event: event),
              ],
            ),
          ),
          const SizedBox(height: 20),
          const SectionTitle('Quick actions'),
          const SizedBox(height: 9),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ActionChip(
                avatar: const Icon(Icons.wallet_outlined, size: 16),
                label: const Text('Review assets'),
                onPressed: () => onSelectTab(1),
              ),
              ActionChip(
                avatar: const Icon(Icons.people_outline, size: 16),
                label: const Text('Manage people'),
                onPressed: () => onSelectTab(2),
              ),
              ActionChip(
                avatar: const Icon(Icons.checklist_rounded, size: 16),
                label: const Text('Readiness'),
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const ReadinessScreen(),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 15),
        ],
      ),
    );
  }
}

class _VaultStatusCard extends StatelessWidget {
  const _VaultStatusCard({
    required this.status,
    required this.lastCheckIn,
    required this.nextCheckIn,
    required this.onCheckIn,
  });
  final VaultStatus status;
  final DateTime lastCheckIn;
  final DateTime nextCheckIn;
  final VoidCallback onCheckIn;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(18),
    decoration: BoxDecoration(
      color: AppColors.dark,
      borderRadius: BorderRadius.circular(17),
      border: Border.all(color: const Color(0xFF26382B)),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Expanded(
              child: Text(
                'VAULT STATUS',
                style: TextStyle(
                  color: Color(0xFFA8B8AA),
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                ),
              ),
            ),
            StatusBadge(label: status.label, tone: toneForStatus(status)),
          ],
        ),
        const SizedBox(height: 13),
        Text(
          status.label,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 23,
            fontWeight: FontWeight.w700,
            letterSpacing: -.5,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Local preview state · not connected to a recovery service',
          style: TextStyle(color: Color(0xFF9EADA0), fontSize: 10),
        ),
        const SizedBox(height: 17),
        Row(
          children: [
            Expanded(
              child: _MiniDate(
                label: 'LAST CHECK-IN',
                value: relativeTime(lastCheckIn),
              ),
            ),
            Expanded(
              child: _MiniDate(
                label: 'NEXT EXPECTED',
                value: '${nextCheckIn.day}/${nextCheckIn.month}',
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: onCheckIn,
            icon: const Icon(Icons.check_circle_outline, size: 18),
            label: const Text('Check in now'),
          ),
        ),
      ],
    ),
  );
}

class _MiniDate extends StatelessWidget {
  const _MiniDate({required this.label, required this.value});
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(
        label,
        style: const TextStyle(
          color: Color(0xFF8FA092),
          fontSize: 8,
          letterSpacing: .7,
        ),
      ),
      const SizedBox(height: 4),
      Text(
        value,
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w600,
          fontSize: 11,
        ),
      ),
    ],
  );
}

class _StagePreview extends StatelessWidget {
  const _StagePreview({
    required this.number,
    required this.title,
    required this.recipient,
  });
  final String number;
  final String title;
  final String recipient;
  @override
  Widget build(BuildContext context) => SurfaceCard(
    padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 12),
    child: Row(
      children: [
        Container(
          width: 31,
          height: 31,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: AppColors.surfaceSoft,
            borderRadius: BorderRadius.circular(9),
          ),
          child: Text(
            number,
            style: const TextStyle(
              color: AppColors.deepGreen,
              fontSize: 10,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(width: 11),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                recipient,
                style: const TextStyle(color: AppColors.muted, fontSize: 10),
              ),
            ],
          ),
        ),
        const StatusBadge(label: 'Locked'),
      ],
    ),
  );
}

class _ActivityRow extends StatelessWidget {
  const _ActivityRow({required this.event});
  final ActivityRecord event;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 12),
    child: Row(
      children: [
        Icon(
          event.warning ? Icons.info_outline : Icons.check_circle_outline,
          size: 17,
          color: event.warning ? AppColors.warning : AppColors.success,
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            event.title,
            style: const TextStyle(fontSize: 11, height: 1.35),
          ),
        ),
        const SizedBox(width: 6),
        Text(
          relativeTime(event.at),
          style: const TextStyle(fontSize: 9, color: AppColors.muted),
        ),
      ],
    ),
  );
}

class ReadinessScreen extends StatelessWidget {
  const ReadinessScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final store = StoreScope.of(context);
    final checks = <(String, String, bool, String)>[
      (
        'Guardians meet the threshold',
        '${store.guardians.length} guardians · ${store.guardianThreshold} approvals required',
        store.guardians.length >= store.guardianThreshold,
        'people',
      ),
      (
        'A legal representative is assigned',
        'The legal representative is assigned to the legal claim stage.',
        store.beneficiaries.any((person) => person.isExecutor),
        'people',
      ),
      (
        'Assets are classified',
        '${store.configuredAssets} of ${store.assets.length} demo assets have setup recorded.',
        store.assets.isNotEmpty &&
            store.assets.every((asset) => asset.configured),
        'vault',
      ),
      (
<<<<<<< Updated upstream
        'Financial nominees reviewed',
        'Manual check · confirm directly with each institution.',
=======
        'You checked in recently',
        'Check-in interval is ${store.checkInDays} days · last check-in ${relativeTime(store.lastCheckIn)}.',
        DateTime.now().difference(store.lastCheckIn).inDays <=
            store.checkInDays,
        'checkin',
      ),
      (
        'Bank and demat nominees are registered',
        'Confirm nominee details directly with each institution.',
>>>>>>> Stashed changes
        store.manualChecks['nominees'] ?? false,
        'nominees',
      ),
      (
        'Legacy contacts reviewed',
        'Manual check · verify provider account settings.',
        store.manualChecks['google'] == true &&
            store.manualChecks['apple'] == true,
        'legacy',
      ),
      (
        'Emergency contact information',
        'Manual check · review whether contact details are current.',
        store.manualChecks['emergency'] ?? false,
        'emergency',
      ),
    ];
    final passed = checks.where((check) => check.$3).length;
    return Scaffold(
      appBar: AppBar(title: const Text('Readiness')),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          const DemoBanner(),
          const SizedBox(height: 16),
          SurfaceCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '$passed of ${checks.length} checks complete',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 4),
                Text(
                  '${checks.length - passed} items still need review. This is a setup checklist, not a security score.',
                  style: const TextStyle(color: AppColors.muted, fontSize: 11),
                ),
                const SizedBox(height: 14),
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: LinearProgressIndicator(
                    value: passed / checks.length,
                    minHeight: 7,
                    backgroundColor: AppColors.surfaceSoft,
                    color: AppColors.success,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          for (final check in checks)
            Padding(
              padding: const EdgeInsets.only(bottom: 9),
              child: SurfaceCard(
                padding: const EdgeInsets.all(13),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      check.$3 ? Icons.check_circle : Icons.error_outline,
                      size: 20,
                      color: check.$3 ? AppColors.success : AppColors.warning,
                    ),
                    const SizedBox(width: 11),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            check.$1,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            check.$2,
                            style: const TextStyle(
                              color: AppColors.muted,
                              fontSize: 10,
                            ),
                          ),
                          if (check.$4 == 'nominees' ||
                              check.$4 == 'legacy' ||
                              check.$4 == 'emergency')
                            TextButton(
                              onPressed: () {
                                if (check.$4 == 'nominees')
                                  store.toggleCheck('nominees');
                                if (check.$4 == 'legacy') {
                                  store.toggleCheck('google');
                                  store.toggleCheck('apple');
                                }
                                if (check.$4 == 'emergency')
                                  store.toggleCheck('emergency');
                              },
                              child: Text(
                                check.$3
                                    ? 'Review later'
                                    : 'Mark manual check complete',
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
