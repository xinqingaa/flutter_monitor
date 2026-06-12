import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:test/test.dart';

void main() {
  test('removes forbidden fields but keeps sensitive http detail', () {
    final filter = PrivacyFilter();

    final filtered = filter.filterAttributes({
      FieldPaths.httpMethod: 'GET',
      FieldPaths.authToken: 'secret',
      FieldPaths.httpRequestBody: {'password': '123456'},
    });

    expect(filtered.containsKey(FieldPaths.authToken), isFalse);
    expect(filtered[FieldPaths.httpMethod], 'GET');
    // HTTP body 自 R3 起按"内部保真采集、可选 redactor"口径保留。
    expect(filtered[FieldPaths.httpRequestBody], {'password': '123456'});
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
        'nested': {FieldPaths.authToken: 'nested-secret', 'keep': 'value'},
        'list': [
          {FieldPaths.authToken: 'list-secret', 'keep': 'item'},
        ],
      },
    );

    final filtered = filter.filterEnvelope(event);

    expect(filtered.payload.containsKey(FieldPaths.authToken), isFalse);
    expect(
      (filtered.payload['nested'] as Map).containsKey(FieldPaths.authToken),
      isFalse,
    );
    expect((filtered.payload['nested'] as Map)['keep'], 'value');
    expect(
      ((filtered.payload['list'] as List).single as Map).containsKey(
        FieldPaths.authToken,
      ),
      isFalse,
    );
    expect(((filtered.payload['list'] as List).single as Map)['keep'], 'item');
  });

  test('keeps http detail layer in payload', () {
    final filter = PrivacyFilter();

    final filtered = filter.filterPayload({
      PayloadKeys.url: 'https://api.example.com/product/1',
      PayloadKeys.httpQuery: {'id': '1'},
      PayloadKeys.httpDetail: {
        PayloadKeys.request: {
          PayloadKeys.headers: {'cookie': 'a=b'},
          PayloadKeys.body: '{"id":1}',
        },
      },
    });

    expect(filtered[PayloadKeys.httpQuery], {'id': '1'});
    final detail = filtered[PayloadKeys.httpDetail] as Map;
    final request = detail[PayloadKeys.request] as Map;
    expect(request[PayloadKeys.headers], {'cookie': 'a=b'});
    expect(request[PayloadKeys.body], '{"id":1}');
  });
}
