import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';
import '../../data/demo_store.dart';
import '../../models/vault_models.dart';
import '../../shared/widgets.dart';
import '../home/home_screen.dart';

class MoreScreen extends StatelessWidget {
  const MoreScreen({
    super.key,
    required this.onRoleSelected,
    required this.onExitDemo,
    required this.isDarkMode,
    required this.onDarkModeChanged,
  });
  final ValueChanged<UserRole> onRoleSelected;
  final VoidCallback onExitDemo;
  final bool isDarkMode;
  final ValueChanged<bool> onDarkModeChanged;
  void _open(BuildContext context, Widget page) =>
      Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => page));

  @override
  Widget build(BuildContext context) {
    final store = StoreScope.of(context);
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 14, 18, 28),
        children: [
          const ScreenHeader(
            title: 'More',
            subtitle: 'Readiness, recovery, and preferences',
          ),
          const DemoBanner(),
          const SizedBox(height: 15),
          SurfaceCard(
            padding: const EdgeInsets.all(15),
            child: Row(
              children: [
                const PersonAvatar(name: 'Owner', size: 46),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Heirloom preview',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'No account is signed in',
                        style: TextStyle(color: AppColors.muted, fontSize: 11),
                      ),
                    ],
                  ),
                ),
                StatusBadge(label: store.role.label),
              ],
            ),
          ),
          const SizedBox(height: 19),
          const SectionTitle('Your workspace'),
          const SizedBox(height: 8),
          _MenuRow(
            icon: Icons.checklist_outlined,
            title: 'Readiness checklist',
            detail: 'Review setup items',
            onTap: () => _open(context, const ReadinessScreen()),
          ),
          _MenuRow(
            icon: Icons.timeline_outlined,
            title: 'Recovery status',
            detail: 'Phases, release stages, and owner intervention',
            onTap: () => _open(context, const RecoveryStatusScreen()),
          ),
          _MenuRow(
            icon: Icons.notifications_none,
            title: 'Notifications',
            detail: 'Demo alerts and reminders',
            onTap: () => _open(context, const NotificationsScreen()),
          ),
          _MenuRow(
            icon: Icons.security_outlined,
            title: 'Security activity',
            detail: 'Local demo activity history',
            onTap: () => _open(context, const SecurityActivityScreen()),
          ),
          _MenuRow(
            icon: Icons.settings_outlined,
            title: 'Settings',
            detail: 'Appearance and demo preferences',
            onTap: () => _open(
              context,
              SettingsScreen(
                isDarkMode: isDarkMode,
                onDarkModeChanged: onDarkModeChanged,
              ),
            ),
          ),
          const SizedBox(height: 18),
          const SectionTitle('Preview a different role'),
          const SizedBox(height: 8),
          for (final role in UserRole.values)
            if (role != store.role)
              _MenuRow(
                icon: switch (role) {
                  UserRole.owner => Icons.person_outline,
                  UserRole.guardian => Icons.verified_user_outlined,
                  UserRole.beneficiary => Icons.favorite_border,
                  UserRole.executor => Icons.assignment_outlined,
                },
                title: 'Switch to ${role.label} demo',
                detail: 'Changes the local preview role. It does not grant account access.',
                onTap: () => onRoleSelected(role),
              ),
          const SizedBox(height: 13),
          OutlinedButton.icon(
            onPressed: () async {
              final okay = await confirmAction(
                context,
                title: 'Reset the local demo?',
                message: 'This resets the recovery preview state on this device. It does not affect any account or backend.',
                confirmLabel: 'Reset demo',
              );
              if (okay && context.mounted) {
                store.resetDemo();
                showDemoMessage(context, 'Local demo state reset.');
              }
            },
            icon: const Icon(Icons.restart_alt),
            label: const Text('Reset demo preview'),
          ),
          const SizedBox(height: 8),
          TextButton.icon(
            onPressed: () async {
              final okay = await confirmAction(
                context,
                title: 'Log out of Heirloom?',
                message: 'This returns to the role picker. No account session is connected in this demo.',
                confirmLabel: 'Log out',
                destructive: true,
              );
              if (okay && context.mounted) onExitDemo();
            },
            icon: const Icon(Icons.logout),
            label: const Text('Log out'),
          ),
        ],
      ),
    );
  }
}

class _MenuRow extends StatelessWidget {
  const _MenuRow({
    required this.icon,
    required this.title,
    required this.detail,
    required this.onTap,
  });
  final IconData icon;
  final String title;
  final String detail;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
    color: Colors.transparent,
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(13),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 12),
        child: Row(
          children: [
            Container(
              width: 39,
              height: 39,
              decoration: BoxDecoration(
                color: AppTheme.softSurfaceOf(context),
                borderRadius: BorderRadius.circular(11),
              ),
              child: Icon(icon, size: 19, color: Theme.of(context).colorScheme.primary),
            ),
            const SizedBox(width: 12),
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
                    detail,
                    style: const TextStyle(
                      fontSize: 10,
                      color: AppColors.muted,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, size: 19, color: AppColors.muted),
          ],
        ),
      ),
    ),
  );
}

class RecoveryStatusScreen extends StatelessWidget {
  const RecoveryStatusScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final store = StoreScope.of(context);
    final phases = [
      VaultStatus.active,
      VaultStatus.watch,
      VaultStatus.triggerPending,
      VaultStatus.vetoWindow,
      VaultStatus.stagedRelease,
      VaultStatus.completed,
    ];
    return Scaffold(
      appBar: AppBar(title: const Text('Recovery status')),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          const DemoBanner(),
          const SizedBox(height: 14),
          SurfaceCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'CURRENT DEMO STATE',
                  style: TextStyle(
                    color: AppColors.muted,
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 9),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        store.status.label,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ),
                    StatusBadge(
                      label: 'Local preview',
                      tone: toneForStatus(store.status),
                    ),
                  ],
                ),
                const SizedBox(height: 9),
                Text(
                  store.recoveryReason,
                  style: const TextStyle(
                    color: AppColors.muted,
                    fontSize: 11,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'This screen does not represent backend approvals or release authorization.',
                  style: TextStyle(color: AppColors.muted, fontSize: 10),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),
          const SectionTitle('Protocol phases'),
          const SizedBox(height: 8),
          for (var i = 0; i < phases.length; i++)
            _PhaseRow(
              index: i,
              status: phases[i],
              current: phases[i] == store.status,
            ),
          const SizedBox(height: 18),
          const SectionTitle('Release stages'),
          const SizedBox(height: 8),
          for (final stage in [
            ('Legal claim packet', 'Executor · claim guidance and inventory'),
            ('Access kit', 'Scoped materials for named recipients'),
            ('Crypto recovery', 'Additional verification and final delay'),
          ])
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: SurfaceCard(
                padding: const EdgeInsets.all(13),
                child: Row(
                  children: [
                    const Icon(
                      Icons.lock_outline,
                      color: AppColors.muted,
                      size: 18,
                    ),
                    const SizedBox(width: 11),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            stage.$1,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            stage.$2,
                            style: const TextStyle(
                              color: AppColors.muted,
                              fontSize: 10,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const StatusBadge(label: 'Locked'),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 14),
          const SectionTitle('Scenario preview'),
          const SizedBox(height: 4),
          const Text(
            'Local-only examples for a hackathon walkthrough. They do not call the protocol or validate evidence.',
            style: TextStyle(color: AppColors.muted, fontSize: 10),
          ),
          const SizedBox(height: 9),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton(
                onPressed: () => store.startScenario('review'),
                child: const Text('Pending review'),
              ),
              OutlinedButton(
                onPressed: () => store.startScenario('legitimate'),
                child: const Text('Veto window example'),
              ),
            ],
          ),
          if (store.isInterventionAvailable)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: _InterventionCard(
                onCancel: () async {
                  final confirmed = await confirmAction(
                    context,
                    title: 'Reset this recovery preview?',
                    message: 'The local demo state will return to Active. This is not a signed or authenticated cancellation request.',
                    confirmLabel: 'Reset preview',
                    destructive: true,
                  );
                  if (confirmed && context.mounted) {
                    store.cancelDemoRecovery();
                    showDemoMessage(
                      context,
                      'Demo recovery preview reset locally.',
                    );
                  }
                },
              ),
            ),
        ],
      ),
    );
  }
}

class _PhaseRow extends StatelessWidget {
  const _PhaseRow({
    required this.index,
    required this.status,
    required this.current,
  });
  final int index;
  final VaultStatus status;
  final bool current;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 7),
    child: Row(
      children: [
        Container(
          width: 28,
          height: 28,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: current ? AppColors.deepGreen : AppTheme.softSurfaceOf(context),
            borderRadius: BorderRadius.circular(9),
          ),
          child: Text(
            '${index + 1}',
            style: TextStyle(
              color: current ? Colors.white : AppColors.muted,
              fontSize: 10,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Text(
            status.label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: current ? FontWeight.w700 : FontWeight.w500,
            ),
          ),
        ),
        if (current) const StatusBadge(label: 'Current', tone: BadgeTone.good),
      ],
    ),
  );
}

class _InterventionCard extends StatelessWidget {
  const _InterventionCard({required this.onCancel});
  final VoidCallback onCancel;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(15),
    decoration: BoxDecoration(
      color: const Color(0xFFFFF3EF),
      border: Border.all(color: const Color(0xFFF1D2CB)),
      borderRadius: BorderRadius.circular(14),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: AppColors.danger),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                'Owner intervention preview',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: AppColors.danger,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 7),
        Text(
          'A demo request is pending. No real recovery request exists, and no reauthentication service is connected.',
          style: TextStyle(
            color: Theme.of(context).colorScheme.onSurface,
            fontSize: 11,
            height: 1.45,
          ),
        ),
        const SizedBox(height: 10),
        FilledButton.tonal(
          onPressed: onCancel,
          child: const Text('I’m safe · reset demo preview'),
        ),
      ],
    ),
  );
}

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final store = StoreScope.of(context);
    final items = [
      (
        'Check-in reminder',
        'Your next check-in is based on the demo cadence.',
        'notice',
      ),
      (
        'Guardian setup',
        '${store.guardians.where((person) => !person.verified).length} demo contacts are not marked verified.',
        'guardian',
      ),
      if (store.isInterventionAvailable)
        (
          'Recovery preview pending',
          'A local scenario is waiting for owner review.',
          'recovery',
        ),
    ];
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          const DemoBanner(),
          const SizedBox(height: 13),
          for (final item in items)
            Padding(
              padding: const EdgeInsets.only(bottom: 9),
              child: SurfaceCard(
                padding: const EdgeInsets.all(13),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.notifications_active_outlined,
                      size: 18,
                      color: AppColors.deepGreen,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            item.$1,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            item.$2,
                            style: const TextStyle(
                              color: AppColors.muted,
                              fontSize: 10,
                            ),
                          ),
                          const SizedBox(height: 7),
                          TextButton(
                            onPressed: () =>
                                store.markNotificationRead(item.$3),
                            child: Text(
                              store.readNotifications.contains(item.$3)
                                  ? 'Read'
                                  : 'Mark read',
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (!store.readNotifications.contains(item.$3))
                      const StatusBadge(label: 'New', tone: BadgeTone.good),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 8),
          const Text(
            'Notification examples are generated from local demo state. Push and email delivery are not configured.',
            style: TextStyle(color: AppColors.muted, fontSize: 10),
          ),
        ],
      ),
    );
  }
}

class SecurityActivityScreen extends StatefulWidget {
  const SecurityActivityScreen({super.key});
  @override
  State<SecurityActivityScreen> createState() => _SecurityActivityScreenState();
}

class _SecurityActivityScreenState extends State<SecurityActivityScreen> {
  bool _warningsOnly = false;
  @override
  Widget build(BuildContext context) {
    final activity = StoreScope.of(context).activity
        .where((event) => !_warningsOnly || event.warning)
        .toList();
    return Scaffold(
      appBar: AppBar(title: const Text('Security activity')),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          const DemoBanner(),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            children: [
              ChoiceChip(
                label: const Text('All events'),
                selected: !_warningsOnly,
                onSelected: (_) => setState(() => _warningsOnly = false),
              ),
              ChoiceChip(
                label: const Text('Needs attention'),
                selected: _warningsOnly,
                onSelected: (_) => setState(() => _warningsOnly = true),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (activity.isEmpty)
            const EmptyState(
              title: 'No matching events',
              message: 'Try showing all activity.',
            )
          else
            for (final event in activity)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: SurfaceCard(
                  padding: const EdgeInsets.all(13),
                  child: Row(
                    children: [
                      Icon(
                        event.warning
                            ? Icons.warning_amber_rounded
                            : Icons.check_circle_outline,
                        size: 18,
                        color: event.warning
                            ? AppColors.warning
                            : AppColors.success,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          event.title,
                          style: const TextStyle(fontSize: 11, height: 1.4),
                        ),
                      ),
                      Text(
                        relativeTime(event.at),
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 9,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          const Text(
            'Only readable demo descriptions are shown. No secret material is displayed.',
            style: TextStyle(color: AppColors.muted, fontSize: 10),
          ),
        ],
      ),
    );
  }
}

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({
    super.key,
    required this.isDarkMode,
    required this.onDarkModeChanged,
  });
  final bool isDarkMode;
  final ValueChanged<bool> onDarkModeChanged;
  @override
  Widget build(BuildContext context) {
    final store = StoreScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          const DemoBanner(),
          const SizedBox(height: 15),
          const SectionTitle('Profile'),
          const SizedBox(height: 8),
          const SurfaceCard(
            child: Row(
              children: [
                PersonAvatar(name: 'Owner'),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Owner profile',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                      Text(
                        'Sample identity · not authenticated',
                        style: TextStyle(color: AppColors.muted, fontSize: 10),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 19),
          const SectionTitle('Appearance'),
          const SizedBox(height: 8),
          SurfaceCard(
            padding: EdgeInsets.zero,
            child: SwitchListTile.adaptive(
              value: isDarkMode,
              onChanged: onDarkModeChanged,
              secondary: Icon(isDarkMode ? Icons.dark_mode : Icons.light_mode),
              title: const Text('Dark mode'),
              subtitle: const Text('Use a darker Heirloom theme'),
            ),
          ),
          const SizedBox(height: 19),
          const SectionTitle('Check-in cadence'),
          const SizedBox(height: 8),
          SurfaceCard(
            child: DropdownButtonFormField<int>(
              initialValue: store.checkInDays,
              decoration: const InputDecoration(
                labelText: 'Expected check-in interval',
              ),
              items: const [1, 3, 7, 14, 30]
                  .map(
                    (days) => DropdownMenuItem(
                      value: days,
                      child: Text('Every $days days'),
                    ),
                  )
                  .toList(),
              onChanged: (value) {
                if (value != null) store.setCheckInDays(value);
              },
            ),
          ),
          const SizedBox(height: 18),
          const SectionTitle('Security and privacy'),
          const SizedBox(height: 8),
          const SurfaceCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Authentication, secure sessions, push notifications, and account export are not connected in this mobile demo.',
                  style: TextStyle(fontSize: 12, height: 1.5),
                ),
                SizedBox(height: 9),
                Text(
                  'Do not enter seed phrases, passwords, PINs, OTPs, or recovery codes.',
                  style: TextStyle(
                    fontSize: 11,
                    color: AppColors.danger,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
