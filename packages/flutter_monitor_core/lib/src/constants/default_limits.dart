const int defaultBreadcrumbLimit = 50;

/// localLive 模式下 HTTP request/response body 的截断上限（字节）。
const int localLiveMaxHttpBodyBytes = 64 * 1024;

/// production 模式下 HTTP request/response body 的截断上限（字节）。
const int productionMaxHttpBodyBytes = 16 * 1024;
