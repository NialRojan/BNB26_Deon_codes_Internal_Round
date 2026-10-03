import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';
import '../../models/vault_models.dart';
import '../../shared/widgets.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key, required this.onContinue});
  final ValueChanged<UserRole> onContinue;

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Stack(
        children: [
          Positioned.fill(
            child: IgnorePointer(child: CustomPaint(painter: _GridPainter())),
          ),
          SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(22, 24, 22, 28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 39,
                      height: 39,
                      decoration: BoxDecoration(
                        color: AppColors.lime,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Center(
                        child: Text(
                          'H',
                          style: TextStyle(
                            color: AppColors.deepGreen,
                            fontWeight: FontWeight.w800,
                            fontSize: 21,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'HEIRLOOM',
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.6,
                          ),
                        ),
                        Text(
                          'DIGITAL LEGACY PROTOCOL',
                          style: TextStyle(
                            fontSize: 8,
                            letterSpacing: 1,
                            color: AppColors.muted,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 36),
                const DemoBanner(),
                const SizedBox(height: 42),
                Container(
                  width: 62,
                  height: 62,
                  decoration: BoxDecoration(
                    color: AppColors.deepGreen,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: const Icon(
                    Icons.shield_moon_outlined,
                    color: AppColors.lime,
                    size: 32,
                  ),
                ),
                const SizedBox(height: 25),
                Text(
                  'Your digital legacy,\nthoughtfully planned.',
                  style: Theme.of(context).textTheme.displaySmall,
                ),
                const SizedBox(height: 14),
                const Text(
                  'Bring important digital assets, recovery instructions, and trusted people into one clear plan.',
                  style: TextStyle(
                    color: AppColors.muted,
                    fontSize: 15,
                    height: 1.55,
                  ),
                ),
                const SizedBox(height: 27),
                const _WelcomeRow(
                  icon: Icons.account_balance_wallet_outlined,
                  title: 'Different assets, different rules',
                  detail: 'Separate financial claim guidance from access and crypto recovery.',
                ),
                const SizedBox(height: 15),
                const _WelcomeRow(
                  icon: Icons.people_outline,
                  title: 'Roles with clear boundaries',
                  detail: 'Guardians, executors, and beneficiaries each have a defined purpose.',
                ),
                const SizedBox(height: 15),
                const _WelcomeRow(
                  icon: Icons.fact_check_outlined,
                  title: 'A process you can understand',
                  detail:
                      'Review conditions, stages, and outstanding setup items.',
                ),
                const SizedBox(height: 31),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: () => onContinue(UserRole.owner),
                    icon: const Icon(Icons.arrow_forward),
                    label: const Text('Explore the owner demo'),
                  ),
                ),
                const SizedBox(height: 18),
                const Center(
                  child: Text(
                    'Preview another role',
                    style: TextStyle(color: AppColors.muted, fontSize: 11),
                  ),
                ),
                const SizedBox(height: 11),
                Wrap(
                  alignment: WrapAlignment.center,
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final role in [
                      UserRole.guardian,
                      UserRole.beneficiary,
                      UserRole.executor,
                    ])
                      OutlinedButton(
                        onPressed: () => onContinue(role),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.deepGreen,
                          side: const BorderSide(color: AppColors.border),
                        ),
                        child: Text(role.label),
                      ),
                  ],
                ),
                const SizedBox(height: 20),
                const Center(
                  child: Text(
                    'This demo does not authenticate or contact a server.',
                    style: TextStyle(color: AppColors.muted, fontSize: 10),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

class _WelcomeRow extends StatelessWidget {
  const _WelcomeRow({
    required this.icon,
    required this.title,
    required this.detail,
  });
  final IconData icon;
  final String title;
  final String detail;
  @override
  Widget build(BuildContext context) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Icon(icon, size: 19, color: AppColors.success),
      const SizedBox(width: 12),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
            ),
            const SizedBox(height: 3),
            Text(
              detail,
              style: const TextStyle(
                color: AppColors.muted,
                fontSize: 11,
                height: 1.45,
              ),
            ),
          ],
        ),
      ),
    ],
  );
}

class _GridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = AppColors.deepGreen.withValues(alpha: .045)
      ..strokeWidth = 1;
    for (double x = 0; x < size.width; x += 32) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += 32) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
