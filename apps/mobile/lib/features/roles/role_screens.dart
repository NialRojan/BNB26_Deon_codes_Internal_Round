import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';
import '../../data/demo_store.dart';
import '../../models/vault_models.dart';
import '../../shared/widgets.dart';

const _requestId = 'demo-request-1';

class GuardianHomeScreen extends StatelessWidget {
  const GuardianHomeScreen({super.key, required this.onRequests});
  final VoidCallback onRequests;
  @override
  Widget build(BuildContext context) {
    final store = StoreScope.of(context);
    final decision = store.guardianDecisions[_requestId];
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 17, 18, 25),
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Hello, Guardian',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Your role is to review, not release.',
                      style: TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                  ],
                ),
              ),
              const PersonAvatar(name: 'Guardian'),
            ],
          ),
          const SizedBox(height: 14),
          const DemoBanner(),
          const SizedBox(height: 16),
          SurfaceCard(
            color: AppColors.dark,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'YOUR RESPONSIBILITY',
                  style: TextStyle(
                    color: Color(0xFFB5C3B7),
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 9),
                const Text(
                  'Review requests independently.',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 19,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'An attestation contributes to a review. It does not independently prove death or incapacity.',
                  style: TextStyle(
                    color: Color(0xFFBBC8BD),
                    fontSize: 11,
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Example guardian threshold',
                        style: TextStyle(
                          color: Color(0xFFAAB8AC),
                          fontSize: 10,
                        ),
                      ),
                    ),
                    StatusBadge(
                      label:
                          '${store.guardianThreshold} of ${store.guardians.length}',
                      tone: BadgeTone.good,
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 19),
          Row(
            children: [
              const Expanded(child: SectionTitle('Requests for review')),
              TextButton(onPressed: onRequests, child: const Text('View all')),
            ],
          ),
          const SizedBox(height: 7),
          if (decision == null)
            _GuardianRequestCard(
              onOpen: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const GuardianRequestDetailScreen(),
                ),
              ),
            )
          else
            EmptyState(
              title: 'You responded: $decision',
              message: 'The local demo records your selection only. It was not sent to a service.',
              icon: Icons.task_alt,
            ),
          const SizedBox(height: 20),
          const SectionTitle('Recent activity'),
          const SizedBox(height: 8),
          SurfaceCard(
            child: Row(
              children: [
                const Icon(Icons.history, size: 19, color: AppColors.deepGreen),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    store.activity.first.title,
                    style: const TextStyle(fontSize: 11),
                  ),
                ),
                Text(
                  relativeTime(store.activity.first.at),
                  style: const TextStyle(color: AppColors.muted, fontSize: 9),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class GuardianRequestsScreen extends StatelessWidget {
  const GuardianRequestsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final store = StoreScope.of(context);
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 24),
        children: [
          const ScreenHeader(
            title: 'Requests',
            subtitle: 'Review each request independently',
          ),
          const DemoBanner(),
          const SizedBox(height: 14),
          if (store.guardianDecisions.containsKey(_requestId))
            EmptyState(
              title: 'No pending requests',
              message: 'Your demo response is recorded locally and has not been submitted.',
            )
          else
            _GuardianRequestCard(
              onOpen: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const GuardianRequestDetailScreen(),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _GuardianRequestCard extends StatelessWidget {
  const _GuardianRequestCard({required this.onOpen});
  final VoidCallback onOpen;
  @override
  Widget build(BuildContext context) => SurfaceCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Expanded(
              child: Text(
                'Recovery request preview',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
              ),
            ),
            const StatusBadge(label: 'Demo request', tone: BadgeTone.warning),
          ],
        ),
        const SizedBox(height: 8),
        const Text(
          'Personal vault · submitted for independent review',
          style: TextStyle(color: AppColors.muted, fontSize: 11),
        ),
        const SizedBox(height: 8),
        const Text(
          'Evidence status: not provided in this local preview.',
          style: TextStyle(color: AppColors.muted, fontSize: 10),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: onOpen,
            icon: const Icon(Icons.fact_check_outlined),
            label: const Text('Review request'),
          ),
        ),
      ],
    ),
  );
}

class GuardianRequestDetailScreen extends StatelessWidget {
  const GuardianRequestDetailScreen({super.key});
  Future<void> _respond(BuildContext context, String decision) async {
    final allowed = await confirmAction(
      context,
      title: '$decision this demo attestation?',
      message: 'Your selection is saved only in local demo state. It will not be authenticated or sent to the vault owner or backend.',
      confirmLabel: 'Save locally',
      destructive: decision == 'Reject',
    );
    if (!context.mounted || !allowed) return;
    StoreScope.of(context).setGuardianDecision(_requestId, decision);
    Navigator.pop(context);
    showDemoMessage(
      context,
      'Demo response saved locally. It was not submitted.',
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Request details')),
    body: ListView(
      padding: const EdgeInsets.all(18),
      children: [
        const DemoBanner(),
        const SizedBox(height: 14),
        SurfaceCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'RECOVERY REQUEST · DEMO',
                style: TextStyle(
                  color: AppColors.muted,
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1,
                ),
              ),
              SizedBox(height: 9),
              Text(
                'Review a reported unavailability',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
              ),
              SizedBox(height: 6),
              Text(
                'You are being asked to independently review the example request and choose whether to attest to the reported circumstances.',
                style: TextStyle(
                  color: AppColors.muted,
                  fontSize: 11,
                  height: 1.5,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        const SurfaceCard(
          child: Column(
            children: [
              _DetailRow(
                'Vault identity',
                'Personal vault · identity limited in demo',
              ),
              Divider(height: 20),
              _DetailRow(
                'Trigger reason',
                'Example missed check-in and guardian review',
              ),
              Divider(height: 20),
              _DetailRow('Evidence', 'No evidence attached to this preview'),
              Divider(height: 20),
              _DetailRow('Example threshold', '3 of 5 guardian approvals'),
              Divider(height: 20),
              _DetailRow('Request state', 'Not submitted to a backend'),
            ],
          ),
        ),
        const SizedBox(height: 12),
        const Text(
          'Guardian approval is one input to a wider review. It does not prove death or incapacity by itself.',
          style: TextStyle(color: AppColors.muted, fontSize: 10, height: 1.5),
        ),
        const SizedBox(height: 18),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: () => _respond(context, 'Approve'),
            icon: const Icon(Icons.check),
            label: const Text('Approve attestation · demo'),
          ),
        ),
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: () => _respond(context, 'Reject'),
            icon: const Icon(Icons.close),
            label: const Text('Reject attestation · demo'),
          ),
        ),
      ],
    ),
  );
}

class GuardianActivityScreen extends StatelessWidget {
  const GuardianActivityScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final events = StoreScope.of(context).activity;
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          const ScreenHeader(
            title: 'Activity',
            subtitle: 'Recent local demo events',
          ),
          const DemoBanner(),
          const SizedBox(height: 12),
          for (final event in events)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: SurfaceCard(
                padding: const EdgeInsets.all(13),
                child: Row(
                  children: [
                    Icon(
                      event.warning ? Icons.warning_amber : Icons.history,
                      color: event.warning
                          ? AppColors.warning
                          : AppColors.deepGreen,
                      size: 18,
                    ),
                    const SizedBox(width: 9),
                    Expanded(
                      child: Text(
                        event.title,
                        style: const TextStyle(fontSize: 10),
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
        ],
      ),
    );
  }
}

class BeneficiaryHomeScreen extends StatelessWidget {
  const BeneficiaryHomeScreen({
    super.key,
    required this.isExecutor,
    required this.onTab,
  });
  final bool isExecutor;
  final ValueChanged<int> onTab;
  @override
  Widget build(BuildContext context) {
    final store = StoreScope.of(context);
    final title = isExecutor ? 'Executor overview' : 'Your recovery overview';
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 26),
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      isExecutor
                          ? 'Claim guidance, when authorized'
                          : 'Materials available to you',
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              PersonAvatar(name: isExecutor ? 'Executor' : 'Beneficiary'),
            ],
          ),
          const SizedBox(height: 14),
          const DemoBanner(),
          const SizedBox(height: 16),
          SurfaceCard(
            color: AppColors.dark,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                StatusBadge(
                  label: store.releaseStage == 0
                      ? 'Access not authorized'
                      : 'Stage ${store.releaseStage} available in preview',
                  tone: store.releaseStage == 0 ? BadgeTone.warning : BadgeTone.good,
                ),
                const SizedBox(height: 13),
                Text(
                  store.releaseStage == 0
                      ? 'Nothing has been released.'
                      : 'Stage ${store.releaseStage} is open.',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 7),
                Text(
                  store.releaseStage == 0
                      ? 'Protected materials stay locked until the fiduciary checks and owner safety delay are complete.'
                      : 'This is a local workflow preview. No protected secret or document is stored in the app.',
                  style: TextStyle(
                    color: Color(0xFFBBC8BD),
                    fontSize: 11,
                    height: 1.5,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 19),
          const SectionTitle('Recovery stages'),
          const SizedBox(height: 8),
          for (final stage in [
            ('01', 'Legal claim packet', 'Executor · immediate after execution'),
            ('02', 'Scoped access kit', 'Assigned beneficiaries · 7-day safety delay'),
            ('03', 'Crypto recovery', 'Custom rules · 30-day delay and milestones'),
          ].indexed)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: SurfaceCard(
                padding: const EdgeInsets.all(13),
                child: Row(
                  children: [
                    Text(
                      stage.$2.$1,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(width: 11),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            stage.$2.$2,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 12,
                            ),
                          ),
                          Text(
                            stage.$2.$3,
                            style: const TextStyle(
                              color: AppColors.muted,
                              fontSize: 10,
                            ),
                          ),
                        ],
                      ),
                    ),
                    StatusBadge(
                      label: store.releaseStage >= stage.$1 + 1
                          ? 'Released'
                          : store.releaseStage > 0
                          ? 'Timelocked'
                          : 'Locked',
                      tone: store.releaseStage >= stage.$1 + 1
                          ? BadgeTone.good
                          : store.releaseStage > 0
                          ? BadgeTone.warning
                          : BadgeTone.neutral,
                    ),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 13),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => onTab(2),
              icon: const Icon(Icons.description_outlined),
              label: const Text('View document checklist'),
            ),
          ),
        ],
      ),
    );
  }
}

class RecoveryMaterialsScreen extends StatelessWidget {
  const RecoveryMaterialsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final store = StoreScope.of(context);
    return Scaffold(
    appBar: AppBar(title: const Text('Recovery access')),
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
                'Access conditions',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 7),
              Text(
                store.releaseStage >= 2
                    ? 'The access-kit stage is marked available in the local preview. No password or recovery code is stored in this app.'
                    : 'The access kit remains locked until Stage 1 execution and the safety time-lock complete.',
                style: const TextStyle(
                  color: AppColors.muted,
                  fontSize: 11,
                  height: 1.5,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        _LockedMaterialCard(
          icon: Icons.password_outlined,
          title: 'Scoped access kit',
          detail: store.releaseStage >= 2 ? 'Stage 2 available · contents not stored here' : 'Stage 2 · time-locked',
          released: store.releaseStage >= 2,
        ),
        const SizedBox(height: 8),
        _LockedMaterialCard(
          icon: Icons.currency_bitcoin,
          title: 'Crypto recovery',
          detail: store.releaseStage >= 3 ? 'Stage 3 available · no key material shown' : 'Stage 3 · additional delay and milestone checks',
          released: store.releaseStage >= 3,
        ),
        const SizedBox(height: 12),
        const Text(
          'A secure reveal still requires verified backend authorization, step-up authentication, and secure key handling.',
          style: TextStyle(color: AppColors.muted, fontSize: 10, height: 1.5),
        ),
      ],
    ),
  );
  }
}

class _LockedMaterialCard extends StatelessWidget {
  const _LockedMaterialCard({
    required this.icon,
    required this.title,
    required this.detail,
    this.released = false,
  });
  final IconData icon;
  final String title;
  final String detail;
  final bool released;
  @override
  Widget build(BuildContext context) => SurfaceCard(
    child: Row(
      children: [
        Icon(icon, color: AppColors.deepGreen),
        const SizedBox(width: 10),
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
              Text(
                detail,
                style: const TextStyle(color: AppColors.muted, fontSize: 10),
              ),
            ],
          ),
        ),
        StatusBadge(label: released ? 'Available' : 'Locked', tone: released ? BadgeTone.good : BadgeTone.neutral),
      ],
    ),
  );
}

class DocumentsScreen extends StatefulWidget {
  const DocumentsScreen({super.key, required this.isExecutor});
  final bool isExecutor;
  @override
  State<DocumentsScreen> createState() => _DocumentsScreenState();
}

class _DocumentsScreenState extends State<DocumentsScreen> {
  final Set<int> _checked = {};
  @override
  Widget build(BuildContext context) {
    final store = StoreScope.of(context);
    final steps = widget.isExecutor
        ? [
            'Review the available account inventory',
            'Confirm nominee and claimant details',
            'Gather the institution’s supporting documents',
            'Follow the institution’s own claim procedure',
            'Record progress with the relevant institution',
          ]
        : [
            'Review your assigned recovery stage',
            'Complete identity verification when requested',
            'Wait for authorized materials to become available',
          ];
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 25),
        children: [
          ScreenHeader(
            title: widget.isExecutor ? 'Claim packet' : 'Documents',
            subtitle: widget.isExecutor
                ? 'A practical checklist for executor tasks'
                : 'Documents assigned to your role',
          ),
          const DemoBanner(),
          const SizedBox(height: 12),
          if (widget.isExecutor && store.releaseStage < 1)
            const SurfaceCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  StatusBadge(label: 'Legal packet locked', tone: BadgeTone.warning),
                  SizedBox(height: 9),
                  Text('The legal packet opens after fiduciary execution at Stage 1.', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                  SizedBox(height: 5),
                  Text('The client website gates this packet on guardian review, document verification, and the owner veto period.', style: TextStyle(color: AppColors.muted, fontSize: 10, height: 1.45)),
                ],
              ),
            )
          else ...[
          SurfaceCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                StatusBadge(
                  label: widget.isExecutor ? 'Stage 1 · Legal packet available in preview' : 'No protected document content stored',
                  tone: widget.isExecutor ? BadgeTone.good : BadgeTone.warning,
                ),
                SizedBox(height: 9),
                Text(
                  'This checklist is general guidance only.',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                ),
                SizedBox(height: 5),
                Text(
                  'Heirloom does not decide legal heirship or transfer ownership. The relevant institution determines its own requirements.',
                  style: TextStyle(
                    color: AppColors.muted,
                    fontSize: 10,
                    height: 1.45,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 17),
          const SectionTitle('Preparation steps'),
          const SizedBox(height: 7),
          for (var i = 0; i < steps.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: 7),
              child: SurfaceCard(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 7,
                ),
                child: CheckboxListTile(
                  value: _checked.contains(i),
                  onChanged: (value) => setState(() {
                    if (value == true) {
                      _checked.add(i);
                    } else {
                      _checked.remove(i);
                    }
                  }),
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.leading,
                  title: Text(steps[i], style: const TextStyle(fontSize: 11)),
                  subtitle: const Text(
                    'Personal checklist only · not a verified claim step',
                    style: TextStyle(fontSize: 9, color: AppColors.muted),
                  ),
                ),
              ),
            ),
          ],
          if (!widget.isExecutor) ...[
            const SizedBox(height: 12),
            const SectionTitle('Recovery materials'),
            const SizedBox(height: 8),
            ListTile(
              tileColor: Theme.of(context).colorScheme.surface,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: AppTheme.borderOf(context)),
              ),
              leading: const Icon(Icons.lock_outline),
              title: const Text('Access kit'),
              subtitle: const Text('Locked in this demo'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const RecoveryMaterialsScreen(),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class RoleProfileScreen extends StatelessWidget {
  const RoleProfileScreen({
    super.key,
    required this.onExitDemo,
    required this.isDarkMode,
    required this.onDarkModeChanged,
  });
  final VoidCallback onExitDemo;
  final bool isDarkMode;
  final ValueChanged<bool> onDarkModeChanged;
  @override
  Widget build(BuildContext context) {
    final role = StoreScope.of(context).role;
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 24),
        children: [
          const ScreenHeader(
            title: 'Profile',
            subtitle: 'Demo role and contact preferences',
          ),
          const DemoBanner(),
          const SizedBox(height: 13),
          SurfaceCard(
            child: Row(
              children: [
                const PersonAvatar(name: 'Demo user', size: 48),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${role.label} demo profile',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 3),
                      const Text(
                        'No user is authenticated',
                        style: TextStyle(color: AppColors.muted, fontSize: 10),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          const SurfaceCard(
            child: Text(
              'Authentication, passkeys, device management, and notification delivery are not connected.',
              style: TextStyle(
                color: AppColors.muted,
                fontSize: 11,
                height: 1.5,
              ),
            ),
          ),
          const SizedBox(height: 15),
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
          const SizedBox(height: 13),
          OutlinedButton.icon(
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

class _DetailRow extends StatelessWidget {
  const _DetailRow(this.label, this.value);
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: Text(
          label,
          style: const TextStyle(color: AppColors.muted, fontSize: 10),
        ),
      ),
      Expanded(
        flex: 2,
        child: Text(
          value,
          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600),
        ),
      ),
    ],
  );
}
