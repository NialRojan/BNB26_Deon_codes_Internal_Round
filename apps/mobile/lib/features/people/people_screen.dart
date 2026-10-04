import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';
import '../../data/demo_store.dart';
import '../../models/vault_models.dart';
import '../../shared/widgets.dart';

class PeopleScreen extends StatefulWidget {
  const PeopleScreen({super.key});
  @override
  State<PeopleScreen> createState() => _PeopleScreenState();
}

class _PeopleScreenState extends State<PeopleScreen> {
  int _tab = 0;

  Future<void> _addPerson(BuildContext context) async {
    final store = StoreScope.of(context);
    final name = TextEditingController();
    final contact = TextEditingController();
    final formKey = GlobalKey<FormState>();
    var role = _tab == 0 ? UserRole.guardian : UserRole.heir;
    var isExecutor = false;
    final person = await showDialog<VaultPerson>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(
            role == UserRole.guardian ? 'Add a guardian' : 'Add a recipient',
          ),
          content: Form(
            key: formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextFormField(
                    controller: name,
                    textCapitalization: TextCapitalization.words,
                    validator: (value) => value == null || value.trim().isEmpty
                        ? 'Enter a name.'
                        : null,
                    decoration: const InputDecoration(labelText: 'Full name'),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: contact,
                    keyboardType: TextInputType.emailAddress,
                    validator: (value) => value == null || value.trim().isEmpty
                        ? 'Enter an email or phone number.'
                        : null,
                    decoration: const InputDecoration(
                      labelText: 'Email or phone',
                    ),
                  ),
                  if (_tab != 0) ...[
                    const SizedBox(height: 12),
                    DropdownButtonFormField<UserRole>(
                      initialValue: role,
                      decoration: const InputDecoration(labelText: 'Role'),
                      items: const [
                        DropdownMenuItem(
                          value: UserRole.heir,
                          child: Text('Heir'),
                        ),
                      ],
                      onChanged: (value) {
                        if (value != null) setDialogState(() => role = value);
                      },
                    ),
                  ],
                  if (_tab != 0)
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      value: isExecutor,
                      onChanged: (value) =>
                          setDialogState(() => isExecutor = value ?? false),
                      title: const Text('Also assign as executor'),
                      subtitle: const Text(
                        'Executor is a plan assignment, not a mobile sign-in role.',
                      ),
                    ),
                  const SizedBox(height: 10),
                  const Text(
                    'This preview saves the contact locally. It does not send an invitation or change backend permissions.',
                    style: TextStyle(color: AppColors.muted, fontSize: 10),
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
                  VaultPerson(
                    id: DateTime.now().microsecondsSinceEpoch.toString(),
                    name: name.text.trim(),
                    contact: contact.text.trim(),
                    role: role,
                    isExecutor: isExecutor,
                  ),
                );
              },
              child: const Text('Add contact'),
            ),
          ],
        ),
      ),
    );
    name.dispose();
    contact.dispose();
    if (person != null && context.mounted) {
      store.addPerson(person);
      showDemoMessage(
        context,
        'Contact added to this demo on your device only.',
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final store = StoreScope.of(context);
    final people = _tab == 0 ? store.guardians : store.beneficiaries;
    return SafeArea(
      child: Column(
        children: [
          ScreenHeader(
            title: 'People',
            subtitle: 'Trusted roles and recipients',
            action: IconButton.filledTonal(
              onPressed: () => _addPerson(context),
              tooltip: 'Add person',
              icon: const Icon(Icons.person_add_alt_1_outlined),
            ),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 18),
            child: DemoBanner(),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 15, 18, 12),
            child: SegmentedButton<int>(
              segments: const [
                ButtonSegment(
                  value: 0,
                  label: Text('Guardians'),
                  icon: Icon(Icons.verified_user_outlined),
                ),
                ButtonSegment(
                  value: 1,
                  label: Text('Recipients'),
                  icon: Icon(Icons.people_outline),
                ),
              ],
              selected: {_tab},
              onSelectionChanged: (value) => setState(() => _tab = value.first),
            ),
          ),
          if (_tab == 0)
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 0, 18, 10),
              child: _ThresholdCard(
                count: store.guardians.length,
                threshold: store.guardianThreshold,
                onChanged: store.setThreshold,
              ),
            ),
          Expanded(
            child: people.isEmpty
                ? const Padding(
                    padding: EdgeInsets.all(18),
                    child: EmptyState(
                      title: 'No people added',
                      message: 'Add a trusted contact to this demo.',
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(18, 4, 18, 20),
                    itemCount: people.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, index) => _PersonCard(
                      person: people[index],
                      guardian: _tab == 0,
                      onRemove: () async {
                        final person = people[index];
                        final okay = await confirmAction(
                          context,
                          title: 'Remove ${person.name}?',
                          message: 'This only removes the contact from local demo state.',
                          confirmLabel: 'Remove',
                          destructive: true,
                        );
                        if (okay && context.mounted) store.removePerson(person);
                      },
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _ThresholdCard extends StatelessWidget {
  const _ThresholdCard({
    required this.count,
    required this.threshold,
    required this.onChanged,
  });
  final int count;
  final int threshold;
  final ValueChanged<int> onChanged;
  @override
  Widget build(BuildContext context) => SurfaceCard(
    padding: const EdgeInsets.all(14),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Expanded(
              child: Text(
                'Guardian approvals',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
              ),
            ),
            Text(
              '$threshold of $count',
              style: const TextStyle(
                color: AppColors.deepGreen,
                fontWeight: FontWeight.w700,
                fontSize: 12,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        const Text(
          'A threshold preview only. Real authorization must be enforced by a trusted backend.',
          style: TextStyle(color: AppColors.muted, fontSize: 10),
        ),
        const SizedBox(height: 9),
        Wrap(
          spacing: 7,
          children: [
            for (var i = 0; i < count; i++)
              CircleAvatar(
                radius: 13,
                backgroundColor: AppColors.surfaceSoft,
                child: Icon(
                  i < threshold ? Icons.person : Icons.person_outline,
                  size: 14,
                  color: i < threshold ? AppColors.success : AppColors.muted,
                ),
              ),
          ],
        ),
        Slider(
          value: threshold
              .toDouble()
              .clamp(2, count < 2 ? 2 : count)
              .toDouble(),
          min: 2,
          max: count < 2 ? 2 : count.toDouble(),
          divisions: count > 2 ? count - 2 : null,
          onChanged: count < 2 ? null : (value) => onChanged(value.round()),
        ),
      ],
    ),
  );
}

class _PersonCard extends StatelessWidget {
  const _PersonCard({
    required this.person,
    required this.guardian,
    required this.onRemove,
  });
  final VaultPerson person;
  final bool guardian;
  final VoidCallback onRemove;
  @override
  Widget build(BuildContext context) => SurfaceCard(
    padding: const EdgeInsets.all(13),
    child: Row(
      children: [
        PersonAvatar(name: person.name),
        const SizedBox(width: 11),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                person.name,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                person.contact,
                style: const TextStyle(color: AppColors.muted, fontSize: 10),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  StatusBadge(
                    label: person.verified
                        ? 'Verified in demo'
                        : 'Not verified',
                    tone: person.verified ? BadgeTone.good : BadgeTone.warning,
                  ),
                  const SizedBox(width: 6),
                  StatusBadge(label: guardian ? 'Guardian' : person.role.label),
                ],
              ),
            ],
          ),
        ),
        IconButton(
          onPressed: onRemove,
          tooltip: 'Remove contact',
          icon: const Icon(Icons.more_horiz),
        ),
      ],
    ),
  );
}
