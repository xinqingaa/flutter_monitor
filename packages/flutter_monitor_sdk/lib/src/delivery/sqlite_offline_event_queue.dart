import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

import 'memory_offline_event_queue.dart';
import 'offline_event_queue.dart';
import 'queued_monitor_event.dart';
import 'package:flutter_monitor_sdk/src/core/monitor_config.dart';

class SqliteOfflineEventQueue implements OfflineEventQueue {
  SqliteOfflineEventQueue({
    required MonitorProductionPolicy policy,
    String? databasePath,
  }) : _policy = policy,
       _databasePath = databasePath;

  static const _table = 'monitor_events';
  final MonitorProductionPolicy _policy;
  final String? _databasePath;
  Database? _database;
  MemoryOfflineEventQueue? _fallback;

  @override
  Future<void> init() async {
    try {
      final path =
          _databasePath ??
          p.join(await getDatabasesPath(), 'flutter_monitor_queue.db');
      _database = await openDatabase(
        path,
        version: 1,
        onCreate: (db, version) async {
          await db.execute('''
CREATE TABLE $_table (
  eventId TEXT PRIMARY KEY,
  sessionId TEXT,
  traceId TEXT,
  name TEXT,
  signalType TEXT,
  priority TEXT NOT NULL,
  createdAt INTEGER NOT NULL,
  nextAttemptAt INTEGER NOT NULL,
  attemptCount INTEGER NOT NULL,
  bytes INTEGER NOT NULL,
  envelope TEXT NOT NULL
)
''');
          await db.execute(
            'CREATE INDEX idx_${_table}_next ON $_table(nextAttemptAt, priority, createdAt)',
          );
        },
      );
    } catch (_) {
      _fallback = MemoryOfflineEventQueue(policy: _policy);
      await _fallback!.init();
    }
  }

  @override
  Future<OfflineQueueEnqueueResult> enqueue(QueuedMonitorEvent event) async {
    final fallback = _fallback;
    if (fallback != null) return fallback.enqueue(event);
    if (event.bytes > _policy.maxEventBytes) {
      return OfflineQueueEnqueueResult(
        accepted: false,
        reason: 'payload_too_large',
        dropped: <QueuedMonitorEvent>[event],
      );
    }
    final db = _requireDatabase();
    await db.insert(
      _table,
      event.toRecord(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
    final dropped = await trimToLimits();
    return OfflineQueueEnqueueResult(accepted: true, dropped: dropped);
  }

  @override
  Future<List<QueuedMonitorEvent>> nextBatch({
    required int maxEvents,
    required int maxBytes,
    required DateTime now,
  }) async {
    final fallback = _fallback;
    if (fallback != null) {
      return fallback.nextBatch(
        maxEvents: maxEvents,
        maxBytes: maxBytes,
        now: now,
      );
    }
    final db = _requireDatabase();
    final records = await db.query(
      _table,
      where: 'nextAttemptAt <= ?',
      whereArgs: <Object?>[now.millisecondsSinceEpoch],
      orderBy:
          "CASE priority WHEN 'critical' THEN 3 WHEN 'high' THEN 2 WHEN 'normal' THEN 1 ELSE 0 END DESC, createdAt ASC",
      limit: maxEvents * 2,
    );
    final batch = <QueuedMonitorEvent>[];
    var bytes = 0;
    for (final record in records) {
      final event = QueuedMonitorEvent.fromRecord(record);
      if (batch.isNotEmpty &&
          (batch.length >= maxEvents || bytes + event.bytes > maxBytes)) {
        break;
      }
      batch.add(event);
      bytes += event.bytes;
      if (batch.length >= maxEvents || bytes >= maxBytes) break;
    }
    return batch;
  }

  @override
  Future<void> ack(List<String> eventIds) async {
    final fallback = _fallback;
    if (fallback != null) return fallback.ack(eventIds);
    if (eventIds.isEmpty) return;
    await _requireDatabase().delete(
      _table,
      where: 'eventId IN (${List.filled(eventIds.length, '?').join(',')})',
      whereArgs: eventIds,
    );
  }

  @override
  Future<void> scheduleRetry(
    List<String> eventIds, {
    required DateTime nextAttemptAt,
  }) async {
    final fallback = _fallback;
    if (fallback != null) {
      return fallback.scheduleRetry(eventIds, nextAttemptAt: nextAttemptAt);
    }
    final db = _requireDatabase();
    await db.transaction((txn) async {
      for (final id in eventIds) {
        await txn.rawUpdate(
          'UPDATE $_table SET attemptCount = attemptCount + 1, nextAttemptAt = ? WHERE eventId = ?',
          <Object?>[nextAttemptAt.millisecondsSinceEpoch, id],
        );
      }
    });
  }

  @override
  Future<List<QueuedMonitorEvent>> trimToLimits() async {
    final fallback = _fallback;
    if (fallback != null) return fallback.trimToLimits();
    final dropped = <QueuedMonitorEvent>[];
    while (true) {
      final current = await stats();
      if (current.length <= _policy.maxQueueEvents &&
          current.bytes <= _policy.maxQueueBytes) {
        return dropped;
      }
      final records = await _requireDatabase().query(
        _table,
        orderBy:
            "CASE priority WHEN 'critical' THEN 3 WHEN 'high' THEN 2 WHEN 'normal' THEN 1 ELSE 0 END ASC, createdAt ASC",
        limit: 1,
      );
      if (records.isEmpty) return dropped;
      final event = QueuedMonitorEvent.fromRecord(records.single);
      dropped.add(event);
      await ack(<String>[event.eventId]);
    }
  }

  @override
  Future<int> deleteExpired(DateTime expireBefore) async {
    final fallback = _fallback;
    if (fallback != null) return fallback.deleteExpired(expireBefore);
    return _requireDatabase().delete(
      _table,
      where: 'createdAt < ?',
      whereArgs: <Object?>[expireBefore.millisecondsSinceEpoch],
    );
  }

  @override
  Future<OfflineQueueStats> stats() async {
    final fallback = _fallback;
    if (fallback != null) return fallback.stats();
    final db = _requireDatabase();
    final rows = await db.rawQuery(
      'SELECT COUNT(*) AS length, COALESCE(SUM(bytes), 0) AS bytes FROM $_table',
    );
    final row = rows.single;
    return OfflineQueueStats(
      length: row['length'] as int,
      bytes: row['bytes'] as int,
    );
  }

  @override
  Future<void> dispose() async {
    await _fallback?.dispose();
    await _database?.close();
    _database = null;
  }

  Database _requireDatabase() {
    final db = _database;
    if (db == null) {
      throw StateError('SqliteOfflineEventQueue is not initialized.');
    }
    return db;
  }
}
