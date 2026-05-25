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

  test('removes forbidden fields from envelope payload recursively', () {
    final filter = PrivacyFilter();
    final event = EventEnvelope(
      eventId: 'evt_001',
      timestamp: DateTime.parse('2026-05-24T12:00:00.000+08:00'),
      signalType: SignalType.error,
      name: 'error.dart',
      payload: const {
        FieldPaths.payloadErrorMessage: 'safe after policy',
        FieldPaths.authToken: 'secret',
        'nested': {FieldPaths.httpRequestHeadersCookie: 'a=b', 'keep': 'value'},
        'list': [
          {FieldPaths.httpResponseBody: 'raw', 'keep': 'item'},
        ],
      },
    );

    final filtered = filter.filterEnvelope(event);

    expect(filtered.payload.containsKey(FieldPaths.authToken), isFalse);
    expect(
      (filtered.payload['nested'] as Map).containsKey(
        FieldPaths.httpRequestHeadersCookie,
      ),
      isFalse,
    );
    expect((filtered.payload['nested'] as Map)['keep'], 'value');
    expect(
      ((filtered.payload['list'] as List).single as Map).containsKey(
        FieldPaths.httpResponseBody,
      ),
      isFalse,
    );
    expect(((filtered.payload['list'] as List).single as Map)['keep'], 'item');
  });
}
