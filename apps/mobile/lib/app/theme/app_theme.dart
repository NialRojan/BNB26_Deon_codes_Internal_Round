import 'package:flutter/material.dart';

abstract final class AppColors {
  static const background = Color(0xFFF5F7F4);
  static const surface = Colors.white;
  static const surfaceSoft = Color(0xFFEDF3ED);
  static const ink = Color(0xFF17221B);
  static const muted = Color(0xFF6B786E);
  static const border = Color(0xFFE1E8E1);
  static const dark = Color(0xFF0B1510);
  static const deepGreen = Color(0xFF173A2B);
  static const lime = Color(0xFFA3E635);
  static const success = Color(0xFF23834D);
  static const warning = Color(0xFFD99B27);
  static const danger = Color(0xFFD94B4B);
}

abstract final class AppTheme {
  static ThemeData get dark {
    const background = Color(0xFF101812);
    const surface = Color(0xFF19251D);
    const softSurface = Color(0xFF223329);
    const foreground = Color(0xFFEAF2EA);
    const muted = Color(0xFFA0AFA2);
    const border = Color(0xFF304237);
    final scheme = ColorScheme.fromSeed(
      seedColor: AppColors.lime,
      brightness: Brightness.dark,
    ).copyWith(
      primary: AppColors.lime,
      onPrimary: AppColors.dark,
      secondary: AppColors.success,
      surface: surface,
      onSurface: foreground,
      error: AppColors.danger,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: background,
      fontFamily: 'Inter',
      textTheme: const TextTheme(
        displaySmall: TextStyle(fontSize: 32, fontWeight: FontWeight.w700, height: 1.1, letterSpacing: -1, color: foreground),
        headlineSmall: TextStyle(fontSize: 23, fontWeight: FontWeight.w600, letterSpacing: -.5, color: foreground),
        titleLarge: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: foreground),
        titleMedium: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: foreground),
        bodyLarge: TextStyle(fontSize: 15, height: 1.45, color: foreground),
        bodyMedium: TextStyle(fontSize: 13, height: 1.45, color: foreground),
        bodySmall: TextStyle(fontSize: 11, height: 1.4, color: muted),
        labelLarge: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: foreground),
      ),
      appBarTheme: const AppBarTheme(backgroundColor: background, foregroundColor: foreground, elevation: 0, centerTitle: false),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        hintStyle: const TextStyle(color: muted),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: border)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: border)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.lime, width: 1.5)),
      ),
      dividerColor: border,
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: surface,
        indicatorColor: softSurface,
        labelTextStyle: WidgetStateProperty.resolveWith((states) => TextStyle(
          fontSize: 10,
          fontWeight: states.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
          color: states.contains(WidgetState.selected) ? AppColors.lime : muted,
        )),
      ),
    );
  }

  static Color softSurfaceOf(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? const Color(0xFF223329)
          : AppColors.surfaceSoft;

  static Color borderOf(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? const Color(0xFF304237)
          : AppColors.border;

  static ThemeData get light {
    final scheme =
        ColorScheme.fromSeed(
          seedColor: AppColors.deepGreen,
          brightness: Brightness.light,
        ).copyWith(
          primary: AppColors.deepGreen,
          secondary: AppColors.lime,
          surface: AppColors.surface,
          error: AppColors.danger,
        );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: AppColors.background,
      fontFamily: 'Inter',
      textTheme: const TextTheme(
        displaySmall: TextStyle(
          fontSize: 32,
          fontWeight: FontWeight.w700,
          height: 1.1,
          letterSpacing: -1,
        ),
        headlineSmall: TextStyle(
          fontSize: 23,
          fontWeight: FontWeight.w600,
          letterSpacing: -.5,
        ),
        titleLarge: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
        titleMedium: TextStyle(fontSize: 15, fontWeight: FontWeight.w600),
        bodyLarge: TextStyle(fontSize: 15, height: 1.45),
        bodyMedium: TextStyle(fontSize: 13, height: 1.45),
        bodySmall: TextStyle(fontSize: 11, height: 1.4),
        labelLarge: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.ink,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: AppColors.ink,
          fontSize: 18,
          fontWeight: FontWeight.w700,
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        hintStyle: const TextStyle(color: AppColors.muted),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 14,
          vertical: 13,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.deepGreen, width: 1.5),
        ),
      ),
      dividerColor: AppColors.border,
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.dark,
        contentTextStyle: const TextStyle(color: Colors.white),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Colors.white,
        indicatorColor: AppColors.surfaceSoft,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            fontSize: 10,
            fontWeight: states.contains(WidgetState.selected)
                ? FontWeight.w700
                : FontWeight.w500,
            color: states.contains(WidgetState.selected)
                ? AppColors.deepGreen
                : AppColors.muted,
          ),
        ),
      ),
    );
  }
}
