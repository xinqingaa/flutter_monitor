import 'package:flutter_monitor_core/flutter_monitor_core.dart';
import 'package:test/test.dart';

void main() {
  test('parses schema versions', () {
    expect(SchemaVersion.parse('1.0'), const SchemaVersion(1, 0));
    expect(SchemaVersion.parse('1.2.3'), const SchemaVersion(1, 2, 3));
    expect(SchemaVersion.parse('1.2.3').toString(), '1.2.3');
  });

  test('checks major compatibility', () {
    expect(
      const SchemaVersion(1, 0).isCompatibleWith(const SchemaVersion(1, 2)),
      isTrue,
    );
    expect(
      const SchemaVersion(1, 0).isCompatibleWith(const SchemaVersion(2, 0)),
      isFalse,
    );
  });

  test('rejects invalid schema versions', () {
    expect(() => SchemaVersion.parse('1'), throwsFormatException);
    expect(() => SchemaVersion.parse('1.x'), throwsFormatException);
    expect(() => SchemaVersion.parse('1.0.0.1'), throwsFormatException);
  });
}
