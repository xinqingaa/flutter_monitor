import '../constants/field_paths.dart';
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
    path: FieldPaths.appStartType,
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.appStartDurationMs,
    valueType: FieldValueType.durationMs,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.appFirstFrameMs,
    valueType: FieldValueType.durationMs,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.appInteractiveMs,
    valueType: FieldValueType.durationMs,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.appLifecycleState,
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.appLifecyclePreviousState,
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.appForegroundDurationMs,
    valueType: FieldValueType.durationMs,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.appBackgroundDurationMs,
    valueType: FieldValueType.durationMs,
    privacyLevel: PrivacyLevel.safe,
  ),
  FieldDefinition(
    path: FieldPaths.appExitFlushSuccess,
    valueType: FieldValueType.boolean,
    privacyLevel: PrivacyLevel.safe,
  ),
  FieldDefinition(
    path: FieldPaths.pageRoute,
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.queryable,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.pageRouteSource,
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.queryable,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.pageModule,
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.queryable,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.pageScene,
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.queryable,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.pageFirstFrameMs,
    valueType: FieldValueType.durationMs,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.pageInteractiveMs,
    valueType: FieldValueType.durationMs,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.pageStayMs,
    valueType: FieldValueType.durationMs,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.httpMethod,
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.httpUrlNormalized,
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.queryable,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.httpStatusCode,
    valueType: FieldValueType.number,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.httpSuccess,
    valueType: FieldValueType.boolean,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.httpErrorType,
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.queryable,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.httpRetryCount,
    valueType: FieldValueType.number,
    privacyLevel: PrivacyLevel.safe,
  ),
  FieldDefinition(
    path: FieldPaths.httpCacheStatus,
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.requestSizeBytes,
    valueType: FieldValueType.number,
    privacyLevel: PrivacyLevel.safe,
  ),
  FieldDefinition(
    path: FieldPaths.responseSizeBytes,
    valueType: FieldValueType.number,
    privacyLevel: PrivacyLevel.safe,
  ),
  FieldDefinition(
    path: FieldPaths.errorType,
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.queryable,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.errorMessage,
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.sensitive,
  ),
  FieldDefinition(
    path: FieldPaths.errorStacktrace,
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.sensitive,
  ),
  FieldDefinition(
    path: FieldPaths.errorHandled,
    valueType: FieldValueType.boolean,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.errorMechanism,
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.queryable,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.errorThread,
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.queryable,
  ),
  FieldDefinition(
    path: FieldPaths.uiFrameMaxMs,
    valueType: FieldValueType.durationMs,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.uiFrameCount,
    valueType: FieldValueType.number,
    privacyLevel: PrivacyLevel.safe,
  ),
  FieldDefinition(
    path: FieldPaths.uiJankCount,
    valueType: FieldValueType.number,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.uiJankDurationMs,
    valueType: FieldValueType.durationMs,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.memoryRssMb,
    valueType: FieldValueType.number,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.memoryHeapUsedMb,
    valueType: FieldValueType.number,
    privacyLevel: PrivacyLevel.safe,
  ),
  FieldDefinition(
    path: FieldPaths.memoryHeapCapacityMb,
    valueType: FieldValueType.number,
    privacyLevel: PrivacyLevel.safe,
  ),
  FieldDefinition(
    path: FieldPaths.memoryExternalMb,
    valueType: FieldValueType.number,
    privacyLevel: PrivacyLevel.safe,
  ),
  FieldDefinition(
    path: FieldPaths.memoryNativeUsedMb,
    valueType: FieldValueType.number,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.memoryGrowthMb,
    valueType: FieldValueType.number,
    privacyLevel: PrivacyLevel.safe,
  ),
  FieldDefinition(
    path: FieldPaths.memoryGrowthDurationMs,
    valueType: FieldValueType.durationMs,
    privacyLevel: PrivacyLevel.safe,
  ),
  FieldDefinition(
    path: FieldPaths.memoryPressureLevel,
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.memorySampleSource,
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.nativePlatform,
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.nativeSignal,
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.nativeThread,
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.queryable,
  ),
  FieldDefinition(
    path: FieldPaths.nativeThreadId,
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.queryable,
  ),
  FieldDefinition(
    path: FieldPaths.nativeCrashType,
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.queryable,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.nativeAnrDurationMs,
    valueType: FieldValueType.durationMs,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.nativeOomReason,
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.queryable,
  ),
  FieldDefinition(
    path: FieldPaths.nativeMemoryUsedMb,
    valueType: FieldValueType.number,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.nativeMemoryPressureLevel,
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.safe,
    indexed: true,
  ),
  FieldDefinition(
    path: FieldPaths.httpUrlQuery,
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.forbidden,
    description: 'Raw URL query is forbidden by default.',
  ),
  FieldDefinition(
    path: FieldPaths.httpRequestBody,
    valueType: FieldValueType.object,
    privacyLevel: PrivacyLevel.forbidden,
    description: 'Request body is forbidden by default.',
  ),
  FieldDefinition(
    path: FieldPaths.httpResponseBody,
    valueType: FieldValueType.object,
    privacyLevel: PrivacyLevel.forbidden,
    description: 'Response body is forbidden by default.',
  ),
  FieldDefinition(
    path: FieldPaths.httpRequestHeadersCookie,
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.forbidden,
    description: 'Cookies are forbidden by default.',
  ),
  FieldDefinition(
    path: FieldPaths.authToken,
    valueType: FieldValueType.string,
    privacyLevel: PrivacyLevel.forbidden,
    description: 'Tokens are forbidden by default.',
  ),
];
