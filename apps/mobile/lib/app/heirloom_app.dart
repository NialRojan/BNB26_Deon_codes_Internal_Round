import 'package:flutter/material.dart';

import '../data/demo_store.dart';
import '../features/onboarding/welcome_screen.dart';
import '../features/shell/mobile_shell.dart';
import 'theme/app_theme.dart';

class HeirloomApp extends StatefulWidget {
  const HeirloomApp({super.key});
  @override
  State<HeirloomApp> createState() => _HeirloomAppState();
}

class _HeirloomAppState extends State<HeirloomApp> {
  bool _enteredDemo = false;
  bool _darkMode = false;

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Heirloom',
    debugShowCheckedModeBanner: false,
    theme: AppTheme.light,
    darkTheme: AppTheme.dark,
    themeMode: _darkMode ? ThemeMode.dark : ThemeMode.light,
    home: _enteredDemo
        ? MobileShell(
            onExitDemo: () => setState(() => _enteredDemo = false),
            isDarkMode: _darkMode,
            onDarkModeChanged: (value) => setState(() => _darkMode = value),
          )
        : WelcomeScreen(
            onContinue: (role) {
              StoreScope.of(context).role = role;
              setState(() => _enteredDemo = true);
            },
          ),
  );
}
