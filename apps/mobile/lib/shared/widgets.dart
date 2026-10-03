import 'package:flutter/material.dart';

import '../app/theme/app_theme.dart';
import '../models/vault_models.dart';

class DemoBanner extends StatelessWidget {
  const DemoBanner({super.key});
  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
    decoration: BoxDecoration(
      color: const Color(0xFFFFF5DF),
      borderRadius: BorderRadius.circular(10),
      border: Border.all(color: const Color(0xFFEBD9AB)),
    ),
    child: const Row(
      children: [
        Icon(Icons.science_outlined, size: 16, color: Color(0xFF996B16)),
        SizedBox(width: 8),
        Expanded(
          child: Text(
            'DEMO MODE · Changes stay on this device. No backend is connected.',
            style: TextStyle(
              color: Color(0xFF76591E),
              fontSize: 10,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    ),
  );
}

class SurfaceCard extends StatelessWidget {
  const SurfaceCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.color,
  });
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? color;
  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: padding,
    decoration: BoxDecoration(
      color: color ?? Theme.of(context).colorScheme.surface,
      borderRadius: BorderRadius.circular(15),
      border: Border.all(color: AppTheme.borderOf(context)),
      boxShadow: const [
        BoxShadow(
          color: Color(0x0817221B),
          blurRadius: 12,
          offset: Offset(0, 3),
        ),
      ],
    ),
    child: child,
  );
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title, {super.key, this.action, this.onAction});
  final String title;
  final String? action;
  final VoidCallback? onAction;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: Text(title, style: Theme.of(context).textTheme.titleLarge),
      ),
      if (action != null)
        TextButton(
          onPressed: onAction,
          style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
          child: Text(action!),
        ),
    ],
  );
}

class ScreenHeader extends StatelessWidget {
  const ScreenHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.action,
  });
  final String title;
  final String? subtitle;
  final Widget? action;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(18, 15, 12, 14),
    child: Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.headlineSmall),
              if (subtitle != null) ...[
                const SizedBox(height: 3),
                Text(
                  subtitle!,
                  style: const TextStyle(color: AppColors.muted, fontSize: 11),
                ),
              ],
            ],
          ),
        ),
        if (action != null) action!,
      ],
    ),
  );
}

class StatusBadge extends StatelessWidget {
  const StatusBadge({
    super.key,
    required this.label,
    this.tone = BadgeTone.neutral,
  });
  final String label;
  final BadgeTone tone;
  @override
  Widget build(BuildContext context) {
    final color = switch (tone) {
      BadgeTone.good => AppColors.success,
      BadgeTone.warning => AppColors.warning,
      BadgeTone.danger => AppColors.danger,
      BadgeTone.neutral => AppColors.muted,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .09),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 10,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

enum BadgeTone { good, warning, danger, neutral }

class MetricTile extends StatelessWidget {
  const MetricTile({
    super.key,
    required this.icon,
    required this.value,
    required this.label,
    this.tone = AppColors.deepGreen,
  });
  final IconData icon;
  final String value;
  final String label;
  final Color tone;
  @override
  Widget build(BuildContext context) => SurfaceCard(
    padding: const EdgeInsets.all(13),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: tone, size: 19),
        const SizedBox(height: 12),
        Text(
          value,
          style: TextStyle(
            fontSize: 21,
            fontWeight: FontWeight.w700,
            color: Theme.of(context).colorScheme.onSurface,
            letterSpacing: -.5,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          label,
          style: const TextStyle(fontSize: 10, color: AppColors.muted),
        ),
      ],
    ),
  );
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.title,
    required this.message,
    this.icon = Icons.inbox_outlined,
  });
  final String title;
  final String message;
  final IconData icon;
  @override
  Widget build(BuildContext context) => SurfaceCard(
    child: Column(
      children: [
        Icon(icon, size: 30, color: AppColors.muted),
        const SizedBox(height: 9),
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 4),
        Text(
          message,
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppColors.muted, fontSize: 12),
        ),
      ],
    ),
  );
}

class PersonAvatar extends StatelessWidget {
  const PersonAvatar({super.key, required this.name, this.size = 40});
  final String name;
  final double size;
  @override
  Widget build(BuildContext context) => CircleAvatar(
    radius: size / 2,
    backgroundColor: AppTheme.softSurfaceOf(context),
    child: Text(
      name.trim().isEmpty
          ? '?'
          : name
                .trim()
                .split(RegExp(r'\s+'))
                .take(2)
                .map((part) => part.characters.first.toUpperCase())
                .join(),
      style: TextStyle(
        color: Theme.of(context).colorScheme.primary,
        fontWeight: FontWeight.w700,
        fontSize: 12,
      ),
    ),
  );
}

String relativeTime(DateTime time) {
  final elapsed = DateTime.now().difference(time);
  if (elapsed.inMinutes < 1) return 'Just now';
  if (elapsed.inHours < 1) return '${elapsed.inMinutes}m ago';
  if (elapsed.inDays < 1) return '${elapsed.inHours}h ago';
  if (elapsed.inDays < 30) return '${elapsed.inDays}d ago';
  return '${time.day}/${time.month}/${time.year}';
}

BadgeTone toneForStatus(VaultStatus status) => switch (status) {
  VaultStatus.active => BadgeTone.good,
  VaultStatus.watch || VaultStatus.vetoWindow => BadgeTone.warning,
  VaultStatus.triggerPending => BadgeTone.danger,
  VaultStatus.stagedRelease || VaultStatus.completed => BadgeTone.neutral,
};

Future<bool> confirmAction(
  BuildContext context, {
  required String title,
  required String message,
  String confirmLabel = 'Continue',
  bool destructive = false,
}) async {
  return await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text(title),
          content: Text(message),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Keep current state'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              style: destructive
                  ? FilledButton.styleFrom(backgroundColor: AppColors.danger)
                  : null,
              child: Text(confirmLabel),
            ),
          ],
        ),
      ) ??
      false;
}

void showDemoMessage(BuildContext context, String message) =>
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
