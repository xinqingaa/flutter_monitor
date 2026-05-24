import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:test/test.dart';

void main() {
  test('removes forbidden fields from attributes', () {
    final filter = PrivacyFilter();

    final filtered = filter.filterAttributes({
      FieldPaths.httpMethod: 'GET',
      FieldPaths.authToken: 'secret',
      FieldPaths.httpRequestBody: {'password': '123456'},
    });

    expect(filtered, {'http.method': 'GET'});
  });
}
