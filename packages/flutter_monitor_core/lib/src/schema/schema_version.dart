class SchemaVersion implements Comparable<SchemaVersion> {
  const SchemaVersion(this.major, this.minor, [this.patch = 0]);

  static const current = SchemaVersion(1, 0);

  final int major;
  final int minor;
  final int patch;

  static SchemaVersion parse(String value) {
    final parts = value.split('.');
    if (parts.length < 2 || parts.length > 3) {
      throw FormatException('Invalid schema version: $value');
    }

    final major = int.tryParse(parts[0]);
    final minor = int.tryParse(parts[1]);
    final patch = parts.length == 3 ? int.tryParse(parts[2]) : 0;
    if (major == null || minor == null || patch == null) {
      throw FormatException('Invalid schema version: $value');
    }
    if (major < 0 || minor < 0 || patch < 0) {
      throw FormatException('Invalid schema version: $value');
    }

    return SchemaVersion(major, minor, patch);
  }

  bool isCompatibleWith(SchemaVersion other) => major == other.major;

  @override
  int compareTo(SchemaVersion other) {
    final majorCompare = major.compareTo(other.major);
    if (majorCompare != 0) return majorCompare;
    final minorCompare = minor.compareTo(other.minor);
    if (minorCompare != 0) return minorCompare;
    return patch.compareTo(other.patch);
  }

  @override
  String toString() {
    if (patch == 0) return '$major.$minor';
    return '$major.$minor.$patch';
  }

  @override
  bool operator ==(Object other) {
    return other is SchemaVersion &&
        other.major == major &&
        other.minor == minor &&
        other.patch == patch;
  }

  @override
  int get hashCode => Object.hash(major, minor, patch);
}
