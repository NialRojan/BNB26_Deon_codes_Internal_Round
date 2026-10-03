import 'package:flutter/material.dart';

import 'app/heirloom_app.dart';
import 'data/demo_store.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(StoreScope(store: DemoStore(), child: const HeirloomApp()));
}
