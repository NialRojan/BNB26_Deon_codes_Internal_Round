import 'package:flutter/material.dart';

import '../../app/theme/app_theme.dart';
import '../../data/demo_store.dart';
import '../../models/vault_models.dart';
import '../home/home_screen.dart';
import '../more/more_screen.dart';
import '../people/people_screen.dart';
import '../roles/role_screens.dart';
import '../vault/vault_screen.dart';

class MobileShell extends StatefulWidget {
  const MobileShell({
    super.key,
    required this.onExitDemo,
    required this.isDarkMode,
    required this.onDarkModeChanged,
  });
  final VoidCallback onExitDemo;
  final bool isDarkMode;
  final ValueChanged<bool> onDarkModeChanged;
  @override
  State<MobileShell> createState() => _MobileShellState();
}

class _MobileShellState extends State<MobileShell> {
  int _index = 0;

  void _switchRole(UserRole role) {
    StoreScope.of(context).role = role;
    setState(() => _index = 0);
  }

  List<Widget> _pages(UserRole role) => switch (role) {
<<<<<<< Updated upstream
    UserRole.owner => [
=======
    UserRole.client => [
>>>>>>> Stashed changes
      OwnerHomeScreen(onSelectTab: (value) => setState(() => _index = value)),
      const VaultScreen(),
      const PeopleScreen(),
      MoreScreen(
        onRoleSelected: _switchRole,
        onExitDemo: widget.onExitDemo,
        isDarkMode: widget.isDarkMode,
        onDarkModeChanged: widget.onDarkModeChanged,
      ),
    ],
    UserRole.guardian => [
      GuardianHomeScreen(onRequests: () => setState(() => _index = 1)),
      const GuardianRequestsScreen(),
      const GuardianActivityScreen(),
      RoleProfileScreen(
        onExitDemo: widget.onExitDemo,
        isDarkMode: widget.isDarkMode,
        onDarkModeChanged: widget.onDarkModeChanged,
      ),
    ],
    UserRole.heir => [
      HeirHomeScreen(onTab: (value) => setState(() => _index = value)),
      const RecoveryMaterialsScreen(),
      RoleProfileScreen(
        onExitDemo: widget.onExitDemo,
        isDarkMode: widget.isDarkMode,
        onDarkModeChanged: widget.onDarkModeChanged,
      ),
    ],
  };

  List<NavigationDestination> _destinations(UserRole role) => switch (role) {
<<<<<<< Updated upstream
    UserRole.owner => const [
=======
    UserRole.client => const [
>>>>>>> Stashed changes
      NavigationDestination(
        icon: Icon(Icons.home_outlined),
        selectedIcon: Icon(Icons.home_rounded),
        label: 'Home',
      ),
      NavigationDestination(
        icon: Icon(Icons.account_balance_wallet_outlined),
        selectedIcon: Icon(Icons.account_balance_wallet),
        label: 'Vault',
      ),
      NavigationDestination(
        icon: Icon(Icons.people_outline),
        selectedIcon: Icon(Icons.people),
        label: 'People',
      ),
      NavigationDestination(
        icon: Icon(Icons.grid_view_outlined),
        selectedIcon: Icon(Icons.grid_view_rounded),
        label: 'More',
      ),
    ],
    UserRole.guardian => const [
      NavigationDestination(
        icon: Icon(Icons.home_outlined),
        selectedIcon: Icon(Icons.home_rounded),
        label: 'Home',
      ),
      NavigationDestination(
        icon: Icon(Icons.fact_check_outlined),
        selectedIcon: Icon(Icons.fact_check),
        label: 'Requests',
      ),
      NavigationDestination(
        icon: Icon(Icons.history),
        selectedIcon: Icon(Icons.history_rounded),
        label: 'Activity',
      ),
      NavigationDestination(
        icon: Icon(Icons.person_outline),
        selectedIcon: Icon(Icons.person),
        label: 'Profile',
      ),
    ],
    UserRole.heir => const [
      NavigationDestination(
        icon: Icon(Icons.home_outlined),
        selectedIcon: Icon(Icons.home_rounded),
        label: 'Overview',
      ),
      NavigationDestination(
        icon: Icon(Icons.lock_outline),
        selectedIcon: Icon(Icons.lock),
        label: 'Recovery',
      ),
      NavigationDestination(
        icon: Icon(Icons.person_outline),
        selectedIcon: Icon(Icons.person),
        label: 'Profile',
      ),
    ],
  };

  @override
  Widget build(BuildContext context) {
    final role = StoreScope.of(context).role;
    final pages = _pages(role);
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: IndexedStack(
        index: _index.clamp(0, pages.length - 1),
        children: pages,
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index.clamp(0, pages.length - 1),
        onDestinationSelected: (value) => setState(() => _index = value),
        destinations: _destinations(role),
      ),
    );
  }
}
