import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';
import '../../data/demo_store.dart';
import '../../models/vault_models.dart';
import '../../shared/widgets.dart';
import '../client/client_workflow_screens.dart';

class VaultScreen extends StatefulWidget {
  const VaultScreen({super.key});
  @override
  State<VaultScreen> createState() => _VaultScreenState();
}

class _VaultScreenState extends State<VaultScreen> {
  final _search = TextEditingController();
  AssetCategory? _filter;
  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _editAsset(BuildContext context, {VaultAsset? existing}) async {
    final store = StoreScope.of(context);
    final name = TextEditingController(text: existing?.name ?? '');
    final detail = TextEditingController(text: existing?.detail ?? '');
    final formKey = GlobalKey<FormState>();
    var category = existing?.category ?? AssetCategory.financial;
    var recipient =
        existing?.recipient ??
        (store.beneficiaries.isEmpty ? '' : store.beneficiaries.first.name);
    var configured = existing?.configured ?? false;
    final result = await showDialog<VaultAsset>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(existing == null ? 'Add an asset' : 'Edit asset'),
          content: Form(
            key: formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DropdownButtonFormField<AssetCategory>(
                    initialValue: category,
                    decoration: const InputDecoration(
                      labelText: 'Asset category',
                    ),
                    items: AssetCategory.values
                        .map(
                          (value) => DropdownMenuItem(
                            value: value,
                            child: Text(value.label),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      if (value != null) setDialogState(() => category = value);
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: name,
                    validator: (value) => value == null || value.trim().isEmpty
                        ? 'Enter an asset name.'
                        : null,
                    decoration: InputDecoration(
                      labelText: category == AssetCategory.financial
                          ? 'Institution or account label'
                          : category == AssetCategory.crypto
                          ? 'Wallet label'
                          : 'Service or password manager',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: detail,
                    minLines: 2,
                    maxLines: 3,
                    decoration: InputDecoration(
                      labelText: 'Recovery notes',
                      helperText: category == AssetCategory.financial
                          ? 'Use account type, last four digits, nominee, or claim steps.'
                          : category == AssetCategory.crypto
                          ? 'Use network and recovery status. Never enter a seed phrase here.'
                          : 'Use recovery method status. Never enter passwords or backup codes here.',
                    ),
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<String>(
                    initialValue: recipient.isEmpty ? null : recipient,
                    decoration: const InputDecoration(
                      labelText: 'Intended recipient',
                    ),
                    items: store.beneficiaries
                        .map(
                          (person) => DropdownMenuItem(
                            value: person.name,
                            child: Text(person.name),
                          ),
                        )
                        .toList(),
                    onChanged: (value) {
                      if (value != null) recipient = value;
                    },
                  ),
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    value: configured,
                    onChanged: (value) =>
                        setDialogState(() => configured = value ?? false),
                    title: const Text(
                      'Recovery setup recorded',
                      style: TextStyle(fontSize: 12),
                    ),
                    subtitle: const Text(
                      'This demo records your selection only.',
                      style: TextStyle(fontSize: 10),
                    ),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () {
                if (!(formKey.currentState?.validate() ?? false)) return;
                Navigator.pop(
                  dialogContext,
                  VaultAsset(
                    id:
                        existing?.id ??
                        DateTime.now().microsecondsSinceEpoch.toString(),
                    name: name.text.trim(),
                    category: category,
                    detail: detail.text.trim().isEmpty
                        ? 'Details not added yet'
                        : detail.text.trim(),
                    recipient: recipient.isEmpty ? 'Not assigned' : recipient,
                    configured: configured,
                    customRule: existing?.customRule,
                  ),
                );
              },
              child: Text(existing == null ? 'Add asset' : 'Save changes'),
            ),
          ],
        ),
      ),
    );
    name.dispose();
    detail.dispose();
    if (!context.mounted || result == null) return;
    if (existing == null) {
      store.addAsset(result);
    } else {
      store.updateAsset(result);
    }
    showDemoMessage(context, 'Asset updated in local demo state only.');
  }

  Future<void> _customizeRule(BuildContext context, VaultAsset asset) async {
    final store = StoreScope.of(context);
    const strategies = [
      'Custom beneficiary split',
      'Distribute equally to all beneficiaries',
      'Staged payouts',
      'Assign to one beneficiary',
    ];
    var strategy = strategies.first;
    var recipient = store.beneficiaries.firstWhere(
      (person) => person.name == asset.recipient,
      orElse: () => store.beneficiaries.first,
    ).name;
    final percent = TextEditingController(text: '100');
    final milestone = TextEditingController(text: 'After required recovery checks');
    final interval = TextEditingController(text: 'Every year');
    final saved = await showDialog<String>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Per-asset release rule'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(asset.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: strategy,
                  decoration: const InputDecoration(labelText: 'Distribution'),
                  items: strategies.map((value) => DropdownMenuItem(value: value, child: Text(value))).toList(),
                  onChanged: (value) {
                    if (value != null) setDialogState(() => strategy = value);
                  },
                ),
                if (strategy == strategies.first) ...[
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    initialValue: recipient,
                    decoration: const InputDecoration(labelText: 'Beneficiary'),
                    items: store.beneficiaries.map((person) => DropdownMenuItem(value: person.name, child: Text(person.name))).toList(),
                    onChanged: (value) {
                      if (value != null) setDialogState(() => recipient = value);
                    },
                  ),
                  const SizedBox(height: 10),
                  TextField(controller: percent, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Share (%)')),
                ],
                if (strategy == strategies.last) ...[
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    initialValue: recipient,
                    decoration: const InputDecoration(labelText: 'Single beneficiary'),
                    items: store.beneficiaries.map((person) => DropdownMenuItem(value: person.name, child: Text(person.name))).toList(),
                    onChanged: (value) {
                      if (value != null) setDialogState(() => recipient = value);
                    },
                  ),
                ],
                if (strategy == strategies[2]) ...[
                  const SizedBox(height: 10),
                  TextField(controller: interval, decoration: const InputDecoration(labelText: 'Payout interval')),
                ],
                const SizedBox(height: 10),
                TextField(controller: milestone, decoration: const InputDecoration(labelText: 'Milestone / unlock condition')),
                const SizedBox(height: 8),
                const Text('Rules are saved to this local preview. No wallet signature or contract update is created.', style: TextStyle(color: AppColors.muted, fontSize: 10)),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(dialogContext), child: const Text('Cancel')),
            FilledButton(
              onPressed: () {
                final rule = switch (strategy) {
                  'Custom beneficiary split' => '$recipient · ${percent.text.trim()}% · ${milestone.text.trim()}',
                  'Distribute equally to all beneficiaries' => 'Equal split across all beneficiaries · ${milestone.text.trim()}',
                  'Staged payouts' => 'Staged payouts · ${interval.text.trim()} · ${milestone.text.trim()}',
                  _ => '100% to $recipient · ${milestone.text.trim()}',
                };
                Navigator.pop(dialogContext, rule);
              },
              child: const Text('Save rule'),
            ),
          ],
        ),
      ),
    );
    percent.dispose();
    milestone.dispose();
    interval.dispose();
    if (saved != null && context.mounted) {
      store.setAssetRule(asset.id, saved);
      showDemoMessage(context, 'Release rule saved in the local preview.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final store = StoreScope.of(context);
    final assets = store.assets
        .where(
          (asset) =>
              (_filter == null || asset.category == _filter) &&
              ('${asset.name} ${asset.detail} ${asset.recipient} ${asset.category.label}'
                  .toLowerCase()
                  .contains(_search.text.toLowerCase())),
        )
        .toList();
    return SafeArea(
      child: Column(
        children: [
          ScreenHeader(
            title: 'Your vault',
            subtitle:
                '${store.assets.length} assets · recovery materials stay hidden',
            action: PopupMenuButton<String>(
              tooltip: 'Manage assets',
              icon: const Icon(Icons.add_circle_outline),
              onSelected: (action) {
                switch (action) {
                  case 'asset':
                    _editAsset(context);
                    break;
                  case 'deposit':
                    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const CryptoDepositScreen()));
                    break;
                  case 'seal':
                    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const SecretSealingScreen()));
                    break;
                }
              },
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'asset', child: Text('Add asset inventory')),
                PopupMenuItem(value: 'deposit', child: Text('Record crypto deposit')),
                PopupMenuItem(value: 'seal', child: Text('Seal an access secret')),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: const DemoBanner(),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 14, 18, 8),
            child: TextField(
              controller: _search,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                hintText: 'Search your assets',
                isDense: true,
              ),
            ),
          ),
          SizedBox(
            height: 42,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 18),
              children: [
                Padding(
                  padding: const EdgeInsets.only(right: 7),
                  child: ChoiceChip(
                    label: const Text('All'),
                    selected: _filter == null,
                    onSelected: (_) => setState(() => _filter = null),
                  ),
                ),
                for (final category in AssetCategory.values)
                  Padding(
                    padding: const EdgeInsets.only(right: 7),
                    child: ChoiceChip(
                      label: Text(category.label),
                      selected: _filter == category,
                      onSelected: (_) => setState(
                        () => _filter = _filter == category ? null : category,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 5),
          Expanded(
            child: assets.isEmpty
                ? const Padding(
                    padding: EdgeInsets.all(18),
                    child: EmptyState(
                      title: 'No matching assets',
                      message: 'Try another search or add an asset to this local demo.',
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(18, 5, 18, 24),
                    itemCount: assets.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 9),
                    itemBuilder: (context, index) => _AssetCard(
                      asset: assets[index],
                      onEdit: () =>
                          _editAsset(context, existing: assets[index]),
                      onRule: () => _customizeRule(context, assets[index]),
                      onDelete: () async {
                        final confirmed = await confirmAction(
                          context,
                          title: 'Remove this asset?',
                          message: 'This only removes the item from the local demo list.',
                          confirmLabel: 'Remove asset',
                          destructive: true,
                        );
                        if (confirmed && context.mounted)
                          store.removeAsset(assets[index].id);
                      },
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _AssetCard extends StatelessWidget {
  const _AssetCard({
    required this.asset,
    required this.onEdit,
    required this.onRule,
    required this.onDelete,
  });
  final VaultAsset asset;
  final VoidCallback onEdit;
  final VoidCallback onRule;
  final VoidCallback onDelete;
  @override
  Widget build(BuildContext context) {
    final icon = switch (asset.category) {
      AssetCategory.crypto => Icons.currency_bitcoin,
      AssetCategory.access => Icons.key_outlined,
      AssetCategory.financial => Icons.account_balance_outlined,
    };
    return SurfaceCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: AppColors.surfaceSoft,
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Icon(icon, color: AppColors.deepGreen, size: 19),
              ),
              const SizedBox(width: 11),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      asset.name,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      asset.category.label,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 10,
                      ),
                    ),
                  ],
                ),
              ),
              StatusBadge(
                label: asset.configured ? 'Setup noted' : 'Needs setup',
                tone: asset.configured ? BadgeTone.good : BadgeTone.warning,
              ),
            ],
          ),
          const SizedBox(height: 11),
          Text(
            asset.detail,
            style: const TextStyle(color: AppColors.muted, fontSize: 11),
          ),
          const Divider(height: 19),
          if (asset.customRule != null) ...[
            Text('Release rule · ${asset.customRule}', style: const TextStyle(fontSize: 10, color: AppColors.success)),
            const SizedBox(height: 6),
          ],
          Text(
            switch (asset.category) {
              AssetCategory.financial => 'Stage 1 · Legal claim packet',
              AssetCategory.access => 'Stage 2 · Time-locked access kit',
              AssetCategory.crypto => 'Stage 3 · Additional checks and delay',
            },
            style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: AppColors.muted),
          ),
          Row(
            children: [
              const Icon(
                Icons.person_outline,
                size: 15,
                color: AppColors.muted,
              ),
              const SizedBox(width: 5),
              Expanded(
                child: Text(
                  'Recipient: ${asset.recipient}',
                  style: const TextStyle(fontSize: 10, color: AppColors.muted),
                ),
              ),
              IconButton(
                visualDensity: VisualDensity.compact,
                tooltip: 'Set release rule',
                onPressed: onRule,
                icon: const Icon(Icons.tune, size: 18),
              ),
              IconButton(
                visualDensity: VisualDensity.compact,
                tooltip: 'Edit',
                onPressed: onEdit,
                icon: const Icon(Icons.edit_outlined, size: 18),
              ),
              IconButton(
                visualDensity: VisualDensity.compact,
                tooltip: 'Remove',
                onPressed: onDelete,
                icon: const Icon(
                  Icons.delete_outline,
                  size: 18,
                  color: AppColors.danger,
                ),
              ),
            ],
          ),
          if (asset.category == AssetCategory.financial)
            const Text(
              'Inventory and claim guidance only — never add banking passwords, UPI PINs, or OTPs.',
              style: TextStyle(
                color: AppColors.muted,
                fontSize: 9,
                height: 1.45,
              ),
            ),
        ],
      ),
    );
  }
}
