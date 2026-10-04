class AppConfig {
  AppConfig._();

  static const apiUrl = String.fromEnvironment('API_URL');
  static const sepoliaRpcUrl = String.fromEnvironment('SEPOLIA_RPC_URL');
  static const walletConnectProjectId = String.fromEnvironment('WC_PROJECT_ID');
  static const onboardingScheme = 'heirloom';
  static const sepoliaChainId = 11155111;

  static List<String> get missingLiveValues => [
    if (apiUrl.trim().isEmpty) 'API_URL',
    if (sepoliaRpcUrl.trim().isEmpty) 'SEPOLIA_RPC_URL',
    if (walletConnectProjectId.trim().isEmpty) 'WC_PROJECT_ID',
  ];

  static void requireLiveConfiguration() {
    final missing = missingLiveValues;
    if (missing.isNotEmpty) {
      throw StateError(
        'Live mode requires --dart-define values for: ${missing.join(', ')}.',
      );
    }
  }
}
