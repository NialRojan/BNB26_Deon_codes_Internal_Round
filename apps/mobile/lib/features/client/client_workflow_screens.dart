import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';
import '../../data/demo_store.dart';
import '../../models/vault_models.dart';
import '../../shared/widgets.dart';

class ClientPlanReviewScreen extends StatefulWidget {
  const ClientPlanReviewScreen({super.key, required this.onContinue});
  final VoidCallback onContinue;

  @override
  State<ClientPlanReviewScreen> createState() => _ClientPlanReviewScreenState();
}

class _ClientPlanReviewScreenState extends State<ClientPlanReviewScreen> {
  bool _confirmed = false;

  @override
  Widget build(BuildContext context) {
    final store = StoreScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Review inheritance plan')),
      body: ListView(
        padding: const EdgeInsets.all(18),
        children: [
          const DemoBanner(),
          const SizedBox(height: 14),
          Text(
            'Review the people, safeguards, and release order in your plan.',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 5),
          const Text(
            'This mirrors the client onboarding review. Confirmation is saved only in this local preview.',
            style: TextStyle(color: Colors.grey, fontSize: 12, height: 1.45),
          ),
          const SizedBox(height: 16),
          _ReviewCard(
            step: '01',
            title: 'People and roles',
            rows: [
              ('Guardians', '${store.guardians.length} listed · ${store.guardianThreshold} approvals required'),
              ('Executor', store.beneficiaries.firstWhere((person) => person.role == UserRole.executor, orElse: () => VaultPerson(id: 'none', name: 'Not assigned', contact: '', role: UserRole.executor)).name),
              ('Beneficiaries', '${store.beneficiaries.where((person) => person.role == UserRole.beneficiary).length} listed'),
            ],
          ),
          const SizedBox(height: 10),
          _ReviewCard(
            step: '02',
            title: 'Recovery safeguards',
            rows: [
              ('Check-in rhythm', 'Every ${store.checkInDays} days'),
              ('Veto window', 'Owner can cancel during the safety delay'),
              ('Approval rule', '${store.guardianThreshold} guardian approvals'),
            ],
          ),
          const SizedBox(height: 10),
          const _ReviewCard(
            step: '03',
            title: 'Release order',
            rows: [
              ('Stage 1', 'Legal claim packet · executor guidance'),
              ('Stage 2', 'Access kit · scoped and time-locked'),
              ('Stage 3', 'Crypto recovery · additional checks and delay'),
            ],
          ),
          const SizedBox(height: 10),
          SurfaceCard(
            padding: EdgeInsets.zero,
            child: CheckboxListTile.adaptive(
              value: _confirmed,
              onChanged: (value) => setState(() => _confirmed = value ?? false),
              title: const Text('I have reviewed these instructions'),
              subtitle: const Text('The client retains authority over assets, release rules, and recovery veto.'),
              controlAffinity: ListTileControlAffinity.leading,
            ),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: _confirmed
                ? () {
                    store.confirmClientPlan();
                    Navigator.of(context).pop();
                    widget.onContinue();
                  }
                : null,
            icon: const Icon(Icons.arrow_forward),
            label: const Text('Confirm and continue to asset setup'),
          ),
        ],
      ),
    );
  }
}

class _ReviewCard extends StatelessWidget {
  const _ReviewCard({required this.step, required this.title, required this.rows});
  final String step;
  final String title;
  final List<(String, String)> rows;

  @override
  Widget build(BuildContext context) => SurfaceCard(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            StatusBadge(label: 'Step $step', tone: BadgeTone.good),
            const SizedBox(width: 9),
            Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w700))),
          ],
        ),
        const SizedBox(height: 11),
        for (var i = 0; i < rows.length; i++) ...[
          if (i > 0) const Divider(height: 15),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(width: 105, child: Text(rows[i].$1, style: const TextStyle(color: Colors.grey, fontSize: 11))),
              Expanded(child: Text(rows[i].$2, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600))),
            ],
          ),
        ],
      ],
    ),
  );
}

class CryptoDepositScreen extends StatefulWidget {
  const CryptoDepositScreen({super.key});

  @override
  State<CryptoDepositScreen> createState() => _CryptoDepositScreenState();
}

class _CryptoDepositScreenState extends State<CryptoDepositScreen> {
  final _amount = TextEditingController(text: '2.5');
  String _asset = 'ETH';
  bool _recorded = false;

  @override
  void dispose() {
    _amount.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Deposit crypto')),
    body: ListView(
      padding: const EdgeInsets.all(18),
      children: [
        const DemoBanner(),
        const SizedBox(height: 14),
        const Text('Client-controlled funding', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 1)),
        const SizedBox(height: 5),
        Text('Record a crypto deposit', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 6),
        const Text('The website can connect a wallet in its live flow. This mobile preview records a sample deposit locally and never requests wallet access.', style: TextStyle(color: Colors.grey, fontSize: 12, height: 1.5)),
        const SizedBox(height: 16),
        SurfaceCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Select token', style: TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'ETH', label: Text('ETH')),
                  ButtonSegment(value: 'USDC', label: Text('USDC')),
                  ButtonSegment(value: 'BTC', label: Text('BTC')),
                ],
                selected: {_asset},
                onSelectionChanged: (value) => setState(() => _asset = value.first),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _amount,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: InputDecoration(labelText: 'Amount ($_asset)'),
              ),
              const SizedBox(height: 13),
              if (_recorded)
                const StatusBadge(label: 'Demo deposit recorded locally', tone: BadgeTone.good),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: _recorded ? null : _recordDeposit,
                  icon: const Icon(Icons.account_balance_wallet_outlined),
                  label: const Text('Record demo deposit'),
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );

  void _recordDeposit() {
    final amount = double.tryParse(_amount.text.trim());
    if (amount == null || amount <= 0) {
      showDemoMessage(context, 'Enter a valid deposit amount.');
      return;
    }
    StoreScope.of(context).addAsset(
      VaultAsset(
        id: DateTime.now().microsecondsSinceEpoch.toString(),
        name: '$_asset deposit',
        category: AssetCategory.crypto,
        detail: '${_amount.text.trim()} $_asset · local preview record, no transaction sent',
        recipient: 'Vault portfolio',
        configured: true,
      ),
    );
    setState(() => _recorded = true);
  }
}

class SecretSealingScreen extends StatefulWidget {
  const SecretSealingScreen({super.key});

  @override
  State<SecretSealingScreen> createState() => _SecretSealingScreenState();
}

class _SecretSealingScreenState extends State<SecretSealingScreen> {
  final _label = TextEditingController();
  @override
  void dispose() {
    _label.dispose();
    super.dispose();
  }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Seal a secret')),
    body: ListView(
      padding: const EdgeInsets.all(18),
      children: [
        const DemoBanner(),
        const SizedBox(height: 14),
        Text('Access kit and password shards', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 7),
        const SurfaceCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              StatusBadge(label: 'Secure sealing unavailable in this preview', tone: BadgeTone.warning),
              SizedBox(height: 10),
              Text('The website seals secrets in the browser before they leave the device. This mobile demo has no equivalent cryptographic storage or key-share service, so it does not accept or store passwords, recovery codes, or seed phrases.', style: TextStyle(fontSize: 12, height: 1.5)),
              SizedBox(height: 9),
              Text('Use this screen to review the flow only. Do not paste a secret here.', style: TextStyle(color: AppColors.danger, fontWeight: FontWeight.w700, fontSize: 11)),
            ],
          ),
        ),
        const SizedBox(height: 14),
        SurfaceCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Add an item to your sealing checklist', style: TextStyle(fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              TextField(
                controller: _label,
                decoration: const InputDecoration(labelText: 'Item label', hintText: 'Password manager recovery key'),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _addChecklistItem,
                  icon: const Icon(Icons.add),
                  label: const Text('Record label only'),
                ),
              ),
            ],
          ),
        ),
      ],
    ),
  );

  void _addChecklistItem() {
    final label = _label.text.trim();
    if (label.isEmpty) {
      showDemoMessage(context, 'Add an item label first.');
      return;
    }
    StoreScope.of(context).addAsset(
      VaultAsset(
        id: DateTime.now().microsecondsSinceEpoch.toString(),
        name: label,
        category: AssetCategory.access,
        detail: 'Pending secure sealing · secret not collected or stored',
        recipient: 'Assigned beneficiaries',
        configured: false,
      ),
    );
    _label.clear();
    showDemoMessage(context, 'Added to the access-kit checklist. No secret value was received.');
  }
}
