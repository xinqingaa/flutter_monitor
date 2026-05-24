import '../privacy/privacy_level.dart';
import 'field_definition.dart';
import 'field_value_type.dart';

class FieldRegistry {
  FieldRegistry(Iterable<FieldDefinition> fields)
    : _fields = {for (final field in fields) field.path: field};

  factory FieldRegistry.defaults() => FieldRegistry(defaultFieldDefinitions);

  final Map<String, FieldDefinition> _fields;

  FieldDefinition? lookup(String path) => _fields[path];

  bool contains(String path) => _fields.containsKey(path);

  Iterable<FieldDefinition> get fields => _fields.values;
}

const defaultFieldDefinitions = <FieldDefinition>[
  FieldDefinition(
    path: 'app.start.type',
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: 'app.start.duration_ms',
    valueType: FieldValueType.durationMs,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: 'app.first_frame_ms',
    valueType: FieldValueType.durationMs,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: 'app.interactive_ms',
    valueType: FieldValueType.durationMs,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: 'page.route',
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.queryable,
    indexed: true,
  ),
  FieldDefinition(
    path: 'page.route.source',
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.queryable,
    indexed: true,
  ),
  FieldDefinition(
    path: 'page.module',
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.queryable,
    indexed: true,
  ),
  FieldDefinition(
    path: 'page.scene',
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.queryable,
    indexed: true,
  ),
  FieldDefinition(
    path: 'page.first_frame_ms',
    valueType: FieldValueType.durationMs,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: 'page.interactive_ms',
    valueType: FieldValueType.durationMs,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: 'page.stay_ms',
    valueType: FieldValueType.durationMs,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: 'http.method',
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: 'http.url.normalized',
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.queryable,
    indexed: true,
  ),
  FieldDefinition(
    path: 'http.status_code',
    valueType: FieldValueType.number,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: 'http.success',
    valueType: FieldValueType.boolean,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: 'http.error_type',
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.queryable,
    indexed: true,
  ),
  FieldDefinition(
    path: 'http.retry_count',
    valueType: FieldValueType.number,
    privacyLevel: PrivacyLevel.safe,
  ),
  FieldDefinition(
    path: 'http.cache_status',
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: 'request.size_bytes',
    valueType: FieldValueType.number,
    privacyLevel: PrivacyLevel.safe,
  ),
  FieldDefinition(
    path: 'response.size_bytes',
    valueType: FieldValueType.number,
    privacyLevel: PrivacyLevel.safe,
  ),
  FieldDefinition(
    path: 'error.type',
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.queryable,
    indexed: true,
  ),
  FieldDefinition(
    path: 'error.message',
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.sensitive,
  ),
  FieldDefinition(
    path: 'error.stacktrace',
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.sensitive,
  ),
  FieldDefinition(
    path: 'error.handled',
    valueType: FieldValueType.boolean,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: 'ui.frame.max_ms',
    valueType: FieldValueType.durationMs,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: 'ui.frame.count',
    valueType: FieldValueType.number,
    privacyLevel: PrivacyLevel.safe,
  ),
  FieldDefinition(
    path: 'ui.jank.count',
    valueType: FieldValueType.number,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: 'ui.jank.duration_ms',
    valueType: FieldValueType.durationMs,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: 'memory.used_mb',
    valueType: FieldValueType.number,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: 'memory.total_mb',
    valueType: FieldValueType.number,
    privacyLevel: PrivacyLevel.safe,
  ),
  FieldDefinition(
    path: 'memory.pressure.level',
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: 'memory.growth_mb',
    valueType: FieldValueType.number,
    privacyLevel: PrivacyLevel.safe,
  ),
  FieldDefinition(
    path: 'native.signal.type',
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: 'native.crash.type',
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.queryable,
    indexed: true,
  ),
  FieldDefinition(
    path: 'native.anr.duration_ms',
    valueType: FieldValueType.durationMs,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: 'http.url.query',
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.forbidden,
    description: 'Raw URL query is forbidden by default.',
  ),
  FieldDefinition(
    path: 'http.request.body',
    valueType: FieldValueType.object,
    privacyLevel: PrivacyLevel.forbidden,
    description: 'Request body is forbidden by default.',
  ),
  FieldDefinition(
    path: 'http.response.body',
    valueType: FieldValueType.object,
    privacyLevel: PrivacyLevel.forbidden,
    description: 'Response body is forbidden by default.',
  ),
  FieldDefinition(
    path: 'http.request.headers.cookie',
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.forbidden,
    description: 'Cookies are forbidden by default.',
  ),
  FieldDefinition(
    path: 'auth.token',
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.forbidden,
    description: 'Tokens are forbidden by default.',
  ),
];
