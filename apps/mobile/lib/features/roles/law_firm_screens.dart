import 'package:flutter/material.dart';

import '../../data/demo_store.dart';
import '../../models/vault_models.dart';
import '../../shared/widgets.dart';

class LawFirmOverviewScreen extends StatelessWidget {
  const LawFirmOverviewScreen({
    super.key,
    required this.onNavigate,
    required this.onRoleSelected,
    required this.isDarkMode,
    required this.onDarkModeChanged,
    required this.onExitDemo,
  });
  final ValueChanged<int> onNavigate;
  final ValueChanged<UserRole> onRoleSelected;
  final bool isDarkMode;
  final ValueChanged<bool> onDarkModeChanged;
  final VoidCallback onExitDemo;

  @override
  Widget build(BuildContext context) {
    final store = StoreScope.of(context);
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 26),
        children: [
          ScreenHeader(
            title: 'Fiduciary overview',
            subtitle: 'Law firm workspace · local demo',
            action: PopupMenuButton<UserRole>(
              tooltip: 'Switch preview role',
              icon: const Icon(Icons.swap_horiz),
              onSelected: onRoleSelected,
              itemBuilder: (_) => UserRole.values
                  .where((role) => role != UserRole.lawyer)
                  .map((role) => PopupMenuItem(value: role, child: Text('Preview ${role.label}')))
                  .toList(),
            ),
          ),
          const DemoBanner(),
          const SizedBox(height: 14),
          SurfaceCard(
            color: const Color(0xFF0B1510),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('ACTIVE CLIENT DOSSIER', style: TextStyle(color: Color(0xFFA3E635), fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: 1)),
                const SizedBox(height: 8),
                Text(store.clientName, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w700)),
                const SizedBox(height: 4),
                Text(store.clientEmail, style: const TextStyle(color: Color(0xFFBCC8BE), fontSize: 11)),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(child: Text('Vault status\n${store.status.label}', style: const TextStyle(color: Colors.white, height: 1.5, fontSize: 11))),
                  Expanded(child: Text('Guardian quorum\n${store.guardianApprovals} / ${store.guardianThreshold}', style: const TextStyle(color: Colors.white, height: 1.5, fontSize: 11))),
                ]),
              ],
            ),
          ),
          const SizedBox(height: 15),
          const SectionTitle('Fiduciary workflow'),
          const SizedBox(height: 8),
          _WorkflowAction(icon: Icons.person_add_alt_1, title: 'Create client vault', detail: 'Record client details and review the plan', onTap: () => onNavigate(1)),
          _WorkflowAction(icon: Icons.fact_check_outlined, title: 'Verify submitted document', detail: 'Review the local death-certificate placeholder', onTap: () => onNavigate(2)),
          _WorkflowAction(icon: Icons.gavel_outlined, title: 'Execute digital will', detail: 'Open Stage 1 after the required checks', onTap: () => onNavigate(3)),
          const SizedBox(height: 12),
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
          const SizedBox(height: 8),
          OutlinedButton.icon(
            onPressed: () async {
              final okay = await confirmAction(context, title: 'Log out of Heirloom?', message: 'This returns to the role picker. No account session is connected in this demo.', confirmLabel: 'Log out', destructive: true);
              if (okay && context.mounted) onExitDemo();
            },
            icon: const Icon(Icons.logout),
            label: const Text('Log out'),
          ),
          const SizedBox(height: 12),
          const Text('This workspace mirrors the website flow, but it cannot verify documents, sign policy, or call a contract.', style: TextStyle(color: Colors.grey, fontSize: 10, height: 1.5)),
        ],
      ),
    );
  }
}

class CreateClientVaultScreen extends StatefulWidget {
  const CreateClientVaultScreen({super.key, required this.onContinue});
  final VoidCallback onContinue;

  @override
  State<CreateClientVaultScreen> createState() => _CreateClientVaultScreenState();
}

class _CreateClientVaultScreenState extends State<CreateClientVaultScreen> {
  late final TextEditingController _name;
  late final TextEditingController _email;
  bool _saved = false;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController();
    _email = TextEditingController();
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final store = StoreScope.of(context);
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 26),
        children: [
          const ScreenHeader(title: 'Create client vault', subtitle: 'Step 1 · client identification'),
          const DemoBanner(),
          const SizedBox(height: 14),
          SurfaceCard(
            child: Column(
              children: [
                TextField(controller: _name, onChanged: (_) => setState(() {}), decoration: const InputDecoration(labelText: 'Client full name')),
                const SizedBox(height: 11),
                TextField(controller: _email, onChanged: (_) => setState(() {}), keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Client email')),
                const SizedBox(height: 13),
                const Align(alignment: Alignment.centerLeft, child: Text('The website wizard also captures heirs and allocations, guardians and quorum, executor, inactivity period, veto delay, and special rules.', style: TextStyle(color: Colors.grey, fontSize: 11, height: 1.5))),
                const SizedBox(height: 13),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _saved || _name.text.trim().isEmpty || _email.text.trim().isEmpty
                        ? null
                        : () {
                            store.updateClientProfile(name: _name.text.trim(), email: _email.text.trim());
                            setState(() => _saved = true);
                            showDemoMessage(context, 'Client profile saved in the local preview.');
                          },
                    child: Text(_saved ? 'Client profile saved' : 'Save demo client profile'),
                  ),
                ),
                if (_saved) ...[
                  const SizedBox(height: 9),
                  TextButton.icon(onPressed: widget.onContinue, icon: const Icon(Icons.arrow_forward), label: const Text('Continue to document review')),
                ],
              ],
            ),
          ),
          const SizedBox(height: 12),
          const Text('No vault contract or onboarding invitation is created from this mobile preview.', style: TextStyle(color: Colors.grey, fontSize: 10)),
        ],
      ),
    );
  }
}

class DocumentVerificationScreen extends StatefulWidget {
  const DocumentVerificationScreen({super.key});

  @override
  State<DocumentVerificationScreen> createState() => _DocumentVerificationScreenState();
}

class _DocumentVerificationScreenState extends State<DocumentVerificationScreen> {
  final _document = TextEditingController(text: 'death_certificate_document.pdf');

  @override
  void dispose() {
    _document.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final store = StoreScope.of(context);
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 26),
        children: [
          const ScreenHeader(title: 'Document verification', subtitle: 'Fiduciary review · local demo'),
          const DemoBanner(),
          const SizedBox(height: 14),
          SurfaceCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(store.clientName, style: const TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 5),
                const Text('The website supports evidence upload and law-firm verification. This mobile preview records a filename only; it does not upload or inspect a document.', style: TextStyle(color: Colors.grey, fontSize: 11, height: 1.5)),
                const SizedBox(height: 12),
                TextField(controller: _document, decoration: const InputDecoration(labelText: 'Document label')),
                const SizedBox(height: 10),
                StatusBadge(label: 'Document: ${store.deathCertificateStatus}', tone: store.deathCertificateStatus == 'Verified' ? BadgeTone.good : BadgeTone.warning),
                const SizedBox(height: 11),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () => store.submitDeathCertificate(_document.text.trim().isEmpty ? 'Unnamed document' : _document.text.trim()),
                    icon: const Icon(Icons.upload_file_outlined),
                    label: const Text('Record document received'),
                  ),
                ),
                if (store.deathCertificateStatus == 'Pending') ...[
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: () async {
                        final okay = await confirmAction(context, title: 'Mark this document verified?', message: 'This only advances the local workflow preview. It is not a legal verification.', confirmLabel: 'Verify in demo');
                        if (okay && context.mounted) store.verifyDeathCertificate(approved: true);
                      },
                      icon: const Icon(Icons.verified_outlined),
                      label: const Text('Verify in demo'),
                    ),
                  ),
                  TextButton(onPressed: () => store.verifyDeathCertificate(approved: false), child: const Text('Reject document in demo')),
                ],
                const SizedBox(height: 7),
                Text('Guardian approvals: ${store.guardianApprovals} / ${store.guardianThreshold}', style: const TextStyle(color: Colors.grey, fontSize: 10)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class ExecuteWillScreen extends StatelessWidget {
  const ExecuteWillScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final store = StoreScope.of(context);
    final documentVerified = store.deathCertificateStatus == 'Verified';
    final quorumReached = store.guardianApprovals >= store.guardianThreshold;
    final vetoWindowOpen = store.status == VaultStatus.vetoWindow;
    final ready = documentVerified && quorumReached && vetoWindowOpen;
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 16, 18, 26),
        children: [
          const ScreenHeader(title: 'Execute digital will', subtitle: 'Fiduciary authorization · local demo'),
          const DemoBanner(),
          const SizedBox(height: 14),
          SurfaceCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(store.clientName, style: const TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 11),
                _GateRow(label: 'Death certificate', value: store.deathCertificateStatus, passed: documentVerified),
                _GateRow(label: 'Guardian quorum', value: '${store.guardianApprovals} / ${store.guardianThreshold}', passed: quorumReached),
                _GateRow(label: 'Owner veto period', value: vetoWindowOpen ? 'Open in demo preview' : 'Safety delay required', passed: vetoWindowOpen),
                const SizedBox(height: 10),
                const Text('The website requires document verification, guardian review, and the full owner veto delay before a will can execute. The local preview cannot run or bypass the real time-lock.', style: TextStyle(color: Colors.grey, fontSize: 11, height: 1.5)),
                const SizedBox(height: 13),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: ready && store.releaseStage == 0 ? store.executeDemoWill : null,
                    icon: const Icon(Icons.gavel),
                    label: Text(store.releaseStage > 0 ? 'Stage 1 opened in demo' : 'Preview Stage 1 release'),
                  ),
                ),
                if (!ready) const Padding(padding: EdgeInsets.only(top: 8), child: Text('Complete document verification, guardian quorum, and the owner veto window first.', style: TextStyle(color: Colors.grey, fontSize: 10))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _GateRow extends StatelessWidget {
  const _GateRow({required this.label, required this.value, required this.passed});
  final String label;
  final String value;
  final bool passed;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Row(children: [
      Icon(passed ? Icons.check_circle : Icons.lock_outline, size: 17, color: passed ? Colors.green : Colors.grey),
      const SizedBox(width: 8),
      Expanded(child: Text(label, style: const TextStyle(fontSize: 11))),
      Text(value, style: TextStyle(fontSize: 10, color: passed ? Colors.green : Colors.grey)),
    ]),
  );
}

class _WorkflowAction extends StatelessWidget {
  const _WorkflowAction({required this.icon, required this.title, required this.detail, required this.onTap});
  final IconData icon;
  final String title;
  final String detail;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 7),
    child: SurfaceCard(
      padding: EdgeInsets.zero,
      child: ListTile(leading: Icon(icon), title: Text(title), subtitle: Text(detail), trailing: const Icon(Icons.chevron_right), onTap: onTap),
    ),
  );
}
