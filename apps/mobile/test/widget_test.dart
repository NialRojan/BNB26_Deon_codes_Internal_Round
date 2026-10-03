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

    await tester.ensureVisible(find.text('Explore the owner demo'));
    await tester.tap(find.text('Explore the owner demo'));
    await tester.pumpAndSettle();
    expect(find.text('Good evening, Owner'), findsOneWidget);

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
}
