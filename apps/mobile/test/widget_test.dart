import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:heirloom_mobile/app/heirloom_app.dart';
import 'package:heirloom_mobile/data/demo_store.dart';

void main() {
  testWidgets('owner demo check-in is explicitly local', (tester) async {
    await tester.pumpWidget(
      StoreScope(store: DemoStore(), child: const HeirloomApp()),
    );
    expect(
      find.text('Your digital legacy,\nthoughtfully planned.'),
      findsOneWidget,
    );

    await tester.ensureVisible(find.text('Open client vault preview'));
    await tester.tap(find.text('Open client vault preview'));
    await tester.pumpAndSettle();
    expect(find.text('Welcome, Rahul Sharma'), findsOneWidget);

    await tester.ensureVisible(find.text('Check in now'));
    await tester.tap(find.text('Check in now'));
    await tester.pumpAndSettle();
    expect(find.text('Record a demo check-in?'), findsOneWidget);
    await tester.tap(find.text('Record locally'));
    await tester.pumpAndSettle();
    expect(
      find.text('Demo check-in saved locally. No server request was made.'),
      findsOneWidget,
    );
  });

  testWidgets('guardian role starts in the request-focused workspace', (
    tester,
  ) async {
    await tester.pumpWidget(
      StoreScope(store: DemoStore(), child: const HeirloomApp()),
    );
    await tester.ensureVisible(find.text('Guardian'));
    await tester.tap(find.text('Guardian'));
    await tester.pumpAndSettle();
    expect(find.text('Hello, Guardian'), findsOneWidget);
    expect(find.text('Requests'), findsOneWidget);
    await tester.ensureVisible(find.text('Recovery request preview'));
    expect(find.text('Recovery request preview'), findsOneWidget);
  });

  testWidgets('owner can change theme and log out cleanly', (tester) async {
    await tester.pumpWidget(
      StoreScope(store: DemoStore(), child: const HeirloomApp()),
    );
    await tester.ensureVisible(find.text('Open client vault preview'));
    await tester.tap(find.text('Open client vault preview'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('More'));
    await tester.pumpAndSettle();
    expect(find.text('Readiness, recovery, and preferences'), findsOneWidget);
    await tester.drag(find.byType(ListView).first, const Offset(0, -650));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Settings'));
    await tester.pumpAndSettle();
    await tester.tap(find.byType(SwitchListTile));
    await tester.pumpAndSettle();
    expect(
      tester.widget<MaterialApp>(find.byType(MaterialApp)).themeMode,
      ThemeMode.dark,
    );

    await tester.pageBack();
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView).first, const Offset(0, -900));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Log out'));
    await tester.pumpAndSettle();
    expect(find.text('Log out of Heirloom?'), findsOneWidget);
    await tester.tap(find.text('Log out').last);
    await tester.pumpAndSettle();
    expect(find.text('Your digital legacy,\nthoughtfully planned.'), findsOneWidget);
  });
}
